import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';
import { inferPresentationStyleTarget } from '@/lib/project-workspace/edit-context/inferPresentationStyleTarget';
import { inferSelectedTargetField } from '@/lib/project-workspace/edit-context/inferSelectedTargetField';
import { extractSectionBackgroundClassFromMessage } from '@/lib/builder/sectionPresentation';
import {
  extractBackgroundColorFromMessage,
  parseColorSwap,
} from '@/lib/project-workspace/edit-shared/preset/presetUtils';
import {
  extractSectionPickFromListReply,
  lastSectionListAssistantTurn,
  wasSectionListClarificationAsked,
} from '@/lib/chat/conversationContextForEdit';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import {
  isBareDuplicateCopyFollowUp,
  isSectionScopedCopyEdit,
} from '@/lib/project-workspace/edit-context/resolveDuplicateCopyTarget';
import { parseSectionTitleCopyEdit } from '@/lib/project-workspace/edit-shared/resolveSectionTarget';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import type { EditPlan } from '@/lib/project-workspace/planner/editPlan.schema';

function readTagline(content: string): string | undefined {
  return content.match(/"tagline"\s*:\s*"([^"]*)"/)?.[1]?.trim();
}

function parseContactField(message: string): { field: string; value: string } | null {
  const phone = message.match(/\b(?:phone|number)\b[^0-9(+]*([(+][\d\s().-]{7,}|\d[\d\s().-]{6,})/i);
  if (phone?.[1]) return { field: 'phone', value: phone[1].trim() };

  const email = message.match(/\b[\w.+-]+@[\w.-]+\.\w+\b/);
  if (email?.[0] && /\bemail\b/i.test(message)) return { field: 'email', value: email[0] };

  const address = message.match(/\baddress\b[^.]*[:\s]+(.+?)(?:\.|$)/i);
  if (address?.[1]?.trim()) return { field: 'address', value: address[1].trim() };

  return null;
}

function parseHeroValue(message: string): { field: string; value: string } | null {
  const quoted = message.match(/\bto\s+["']([^"']+)["']/i);
  if (quoted?.[1] && /\bheadline\b/i.test(message)) {
    return { field: 'headline', value: quoted[1].trim() };
  }
  const plain = message.match(/\bheadline\b[^.]*\bto\s+(.+?)(?:\.|$)/i);
  if (plain?.[1]) return { field: 'headline', value: plain[1].trim() };
  return null;
}

function parseQuotedReplacement(
  message: string,
  siteConfigContent: string
): { from: string; to: string; field: string } | null {
  const match = message.match(/["']([^"']+)["']\s+to\s+["']([^"']+)["']/i);
  if (!match?.[1] || !match[2]) return null;

  const from = match[1].trim();
  const to = match[2].trim();
  const parsed = parseSiteConfigSource(siteConfigContent);
  if (!parsed) return null;

  const hits: string[] = [];
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (parsed.businessName?.trim() === from) hits.push('businessName');
  if (siteConfigContent.match(new RegExp(`"headline"\\s*:\\s*"${escaped}"`))) {
    hits.push('hero.headline');
  }
  if (siteConfigContent.match(new RegExp(`"subheadline"\\s*:\\s*"${escaped}"`))) {
    hits.push('hero.subheadline');
  }
  if (parsed.businessName?.trim() !== from && readTagline(siteConfigContent) === from) {
    hits.push('tagline');
  }

  for (const section of parsed.sections ?? []) {
    if (String(section.title ?? '').trim() === from) hits.push(`section.title:${section.title}`);
    if (String(section.body ?? '').trim() === from) hits.push(`section.body:${section.title}`);
  }

  if (hits.length !== 1) return null;

  return { from, to, field: hits[0] };
}

function planDuplicateBusinessAndHero(editContext: EditContext, newValue: string): EditPlan | null {
  const content = editContext.siteModel.siteConfigContent;
  if (!content) return null;

  const message = editContext.effectiveMessage;
  const history = editContext.conversationHistory ?? [];

  if (isSectionScopedCopyEdit(message) || parseSectionTitleCopyEdit(message)) {
    return null;
  }

  if (!isBareDuplicateCopyFollowUp(message, history)) {
    return null;
  }

  const parsed = parseSiteConfigSource(content);
  const businessName = parsed?.businessName?.trim() ?? '';
  const headlineMatch = content.match(/"headline"\s*:\s*"([^"]*)"/);
  const headline = headlineMatch?.[1]?.trim() ?? '';
  if (!businessName || businessName !== headline) return null;

  return {
    planVersion: 'website-agent',
    needsClarification: false,
    intent: 'copy',
    targets: [
      { kind: 'businessName', field: 'businessName' },
      { kind: 'hero', field: 'headline' },
    ],
    verification: [
      { kind: 'business_name', expectedValue: newValue },
      { kind: 'hero_field', field: 'headline', expectedValue: newValue },
    ],
    steps: [
      { skill: 'update_business_name', params: { value: newValue } },
      { skill: 'update_hero', params: { field: 'headline', value: newValue } },
    ],
  };
}

function planNumberedSectionFollowUp(editContext: EditContext): EditPlan | null {
  const history = editContext.conversationHistory ?? [];
  const message = editContext.ownerMessage.trim();
  const numMatch = message.match(/^(\d)\s*(?:—|$|\b)/);
  if (!numMatch || !wasSectionListClarificationAsked(history)) return null;

  const pick = parseInt(numMatch[1], 10);
  const assistant = lastSectionListAssistantTurn(history);
  const pickInfo = assistant ? extractSectionPickFromListReply(assistant.content, pick) : null;
  if (!pickInfo) return null;

  const effective = editContext.effectiveMessage;
  const what = classifyEditWhat(effective);
  if (what !== 'style_background') return null;

  const bgClass = extractSectionBackgroundClassFromMessage(effective);
  const color = extractBackgroundColorFromMessage(effective);
  if (!bgClass && !color) return null;

  return {
    planVersion: 'website-agent',
    needsClarification: false,
    intent: 'style',
    targets: [
      {
        kind: 'section',
        sectionIndex: pickInfo.sectionIndex,
        sectionTitle: pickInfo.title,
      },
    ],
    steps: [
      {
        skill: 'update_section_style',
        target: { sectionIndex: pickInfo.sectionIndex, title: pickInfo.title },
        params: {
          sectionIndex: pickInfo.sectionIndex,
          backgroundClass: bgClass ?? undefined,
          backgroundColor: color ?? undefined,
        },
      },
    ],
  };
}

function planHeroBackgroundStyle(editContext: EditContext): EditPlan | null {
  if (editContext.target.kind !== 'hero') return null;

  const message = editContext.effectiveMessage;
  const what = classifyEditWhat(message);
  if (what !== 'style_background') return null;

  const swap = parseColorSwap(message);
  const bgClass = extractSectionBackgroundClassFromMessage(message);
  const color = extractBackgroundColorFromMessage(message);

  if (!swap && !bgClass && !color) return null;

  return {
    planVersion: 'website-agent',
    needsClarification: false,
    intent: 'theme',
    targets: [{ kind: 'hero' }],
    verification: [{ kind: 'generic' }],
    risk: { level: editContext.riskFlags.level, reasons: editContext.riskFlags.reasons },
    steps: [
      {
        skill: 'update_theme',
        params: { scope: 'hero' },
      },
    ],
  };
}

/**
 * Rule-based plan for high-confidence requests (no LLM).
 */
export function buildDeterministicPlan(editContext: EditContext): EditPlan | null {
  const message = editContext.effectiveMessage;
  const what = classifyEditWhat(message);
  const siteConfigContent = editContext.siteModel.siteConfigContent ?? '';

  if (editContext.target.needsClarification) {
    return {
      planVersion: 'website-agent',
      needsClarification: true,
      clarificationQuestion: editContext.target.clarificationMessage,
      suggestedReplies: editContext.target.suggestedReplies,
      intent: 'clarification',
      steps: [],
      risk: { level: editContext.riskFlags.level, reasons: editContext.riskFlags.reasons },
    };
  }

  const numbered = planNumberedSectionFollowUp(editContext);
  if (numbered) return numbered;

  const heroStyle = planHeroBackgroundStyle(editContext);
  if (heroStyle) return heroStyle;

  if (editContext.selectedTarget && editContext.selectedTargetContext) {
    const inferred = inferSelectedTargetField(
      message,
      editContext.selectedTargetContext,
      what
    );
    if (inferred?.skipCopyInference) {
      // fall through to style handlers below
    } else if (
      inferred?.fieldPath &&
      inferred.value &&
      what === 'copy' &&
      editContext.target.confidence !== 'low'
    ) {
      const sectionIndex = editContext.target.sectionIndex;
      return {
        planVersion: 'website-agent',
        needsClarification: false,
        intent: 'copy',
        targets: sectionIndex != null
          ? [
              {
                kind: 'section',
                sectionIndex,
                sectionTitle: editContext.target.title,
                sectionType: editContext.target.sectionType,
                field: inferred.fieldPath,
              },
            ]
          : [{ kind: 'hero', field: inferred.fieldPath }],
        verification: [
          {
            kind: 'copy_field',
            field: inferred.fieldPath,
            sectionIndex,
            expectedValue: inferred.value,
          },
        ],
        risk: { level: editContext.riskFlags.level, reasons: editContext.riskFlags.reasons },
        steps: [
          {
            skill: 'update_config_field',
            params: { fieldPath: inferred.fieldPath, value: inferred.value },
          },
        ],
      };
    }
  }

  const sectionCopy = parseSectionTitleCopyEdit(message);
  if (
    sectionCopy &&
    what === 'copy' &&
    editContext.target.sectionIndex != null &&
    editContext.target.confidence !== 'low'
  ) {
    const sectionIndex = editContext.target.sectionIndex;
    return {
      planVersion: 'website-agent',
      needsClarification: false,
      intent: 'copy',
      targets: [
        {
          kind: 'section',
          sectionIndex,
          sectionTitle: editContext.target.title,
          sectionType: editContext.target.sectionType,
        },
      ],
      verification: [
        {
          kind: 'copy_field',
          sectionIndex,
          field: sectionCopy.field,
          expectedValue: sectionCopy.value,
        },
      ],
      risk: { level: editContext.riskFlags.level, reasons: editContext.riskFlags.reasons },
      steps: [
        {
          skill: 'update_section_copy',
          target: {
            sectionIndex,
            title: editContext.target.title,
            sectionType: editContext.target.sectionType,
          },
          params: {
            sectionIndex,
            field: sectionCopy.field,
            value: sectionCopy.value,
          },
        },
      ],
    };
  }

  const trimmed = message.trim();
  if (trimmed.length >= 3 && trimmed.length < 120 && !/["']/.test(trimmed)) {
    const duplicatePlan = planDuplicateBusinessAndHero(editContext, trimmed);
    if (duplicatePlan) return duplicatePlan;
  }

  if (siteConfigContent) {
    const quoted = parseQuotedReplacement(message, siteConfigContent);
    if (quoted) {
      if (quoted.field === 'businessName') {
        return {
          planVersion: 'website-agent',
          needsClarification: false,
          intent: 'copy',
          steps: [{ skill: 'update_business_name', params: { value: quoted.to } }],
        };
      }
      if (quoted.field === 'hero.headline') {
        return {
          planVersion: 'website-agent',
          needsClarification: false,
          intent: 'copy',
          steps: [
            { skill: 'update_hero', params: { field: 'headline', value: quoted.to } },
          ],
        };
      }
      if (quoted.field.startsWith('section.title')) {
        const sectionIndex = editContext.target.sectionIndex;
        if (sectionIndex == null) return null;
        return {
          planVersion: 'website-agent',
          needsClarification: false,
          intent: 'copy',
          targets: [
            {
              kind: 'section',
              sectionIndex,
              sectionTitle: editContext.target.title,
              sectionType: editContext.target.sectionType,
            },
          ],
          steps: [
            {
              skill: 'update_section_copy',
              target: {
                sectionIndex,
                title: editContext.target.title,
                sectionType: editContext.target.sectionType,
              },
              params: { sectionIndex, field: 'title', value: quoted.to },
            },
          ],
        };
      }
    }
  }

  if (editContext.target.sectionIndex != null) {
    const bgClass = extractSectionBackgroundClassFromMessage(message);
    const color = extractBackgroundColorFromMessage(message);
    if (bgClass || color) {
      const styleTarget = inferPresentationStyleTarget(
        message,
        editContext.selectedTargetContext,
        editContext.target.title
      );
      const isInnerElementStyle =
        styleTarget.presentationField === 'cardClass' && styleTarget.confidence === 'high';
      const hasPinnedSectionTarget =
        editContext.target.sectionIndex != null && !!editContext.selectedTarget;
      const hasColorStyleSignal = Boolean(bgClass || color);
      const isSectionStyle =
        hasColorStyleSignal &&
        (what === 'style_background' ||
          what === 'style_card' ||
          isInnerElementStyle ||
          hasPinnedSectionTarget);

      if (isSectionStyle) {
        return {
          planVersion: 'website-agent',
          needsClarification: false,
          intent: 'style',
          targets: [
            {
              kind: 'section',
              sectionIndex: editContext.target.sectionIndex,
              sectionTitle: editContext.target.title,
              sectionType: editContext.target.sectionType,
            },
          ],
          verification: [
            {
              kind: 'section_background',
              sectionIndex: editContext.target.sectionIndex,
              field: styleTarget.presentationField,
              expectedValue: bgClass ?? undefined,
            },
          ],
          risk: { level: editContext.riskFlags.level, reasons: editContext.riskFlags.reasons },
          steps: [
            {
              skill: 'update_section_style',
              target: {
                sectionIndex: editContext.target.sectionIndex,
                sectionType: editContext.target.sectionType,
                title: editContext.target.title,
              },
              params: {
                backgroundClass: bgClass ?? undefined,
                backgroundColor: color ?? undefined,
                presentationField: styleTarget.presentationField,
              },
            },
          ],
        };
      }
    }
  }

  const contact = parseContactField(message);
  if (contact) {
    return {
      planVersion: 'website-agent',
      needsClarification: false,
      intent: 'contact',
      verification: [{ kind: 'contact_field', field: contact.field, expectedValue: contact.value }],
      risk: { level: editContext.riskFlags.level, reasons: editContext.riskFlags.reasons },
      steps: [
        {
          skill: 'update_contact',
          params: { [contact.field]: contact.value, field: contact.field, value: contact.value },
        },
      ],
    };
  }

  const hero = parseHeroValue(message);
  if (hero && editContext.target.kind === 'hero') {
    return {
      planVersion: 'website-agent',
      needsClarification: false,
      intent: 'copy',
      targets: [{ kind: 'hero', field: hero.field }],
      steps: [
        {
          skill: 'update_hero',
          params: { [hero.field]: hero.value, field: hero.field, value: hero.value },
        },
      ],
    };
  }

  const addService = message.match(/\badd\s+(.+?)\s+to\s+services\b/i);
  if (addService?.[1]) {
    return {
      planVersion: 'website-agent',
      needsClarification: false,
      intent: 'section',
      steps: [
        {
          skill: 'add_service',
          params: { title: addService[1].trim() },
        },
      ],
    };
  }

  return null;
}
