import { classifyEditWhat } from '@/lib/project-workspace/website-edit-agent/buildGroundedEditContext';
import { extractSectionBackgroundClassFromMessage } from '@/lib/builder/sectionPresentation';
import { extractBackgroundColorFromMessage } from '@/lib/project-workspace/website-edit-agent/preset/presetUtils';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import type { EditPlan } from '@/lib/project-workspace/planner/editPlan.schema';

function parseContactField(message: string): { field: string; value: string } | null {
  const phone = message.match(/\b(?:phone|number)\b[^0-9(+]*([(+][\d\s().-]{7,}|\d[\d\s().-]{6,})/i);
  if (phone?.[1]) return { field: 'phone', value: phone[1].trim() };

  const email = message.match(/\b[\w.+-]+@[\w.-]+\.\w+\b/);
  if (email?.[0] && /\bemail\b/i.test(message)) return { field: 'email', value: email[0] };

  return null;
}

function parseHeroValue(message: string): { field: string; value: string } | null {
  const quoted = message.match(/\bto\s+["']([^"']+)["']/i);
  if (quoted?.[1] && /\bheadline\b/i.test(message)) {
    return { field: 'headline', value: quoted[1].trim() };
  }
  return null;
}

/**
 * Rule-based plan for high-confidence requests (no LLM).
 */
export function buildDeterministicPlan(editContext: EditContext): EditPlan | null {
  const message = editContext.effectiveMessage;
  const what = classifyEditWhat(message);

  if (editContext.target.needsClarification) {
    return {
      planVersion: 'website-agent-v3',
      needsClarification: true,
      clarificationQuestion: editContext.target.clarificationMessage,
      suggestedReplies: editContext.target.suggestedReplies,
      intent: 'clarification',
      steps: [],
      risk: { level: editContext.riskFlags.level, reasons: editContext.riskFlags.reasons },
    };
  }

  if (what === 'style_background' && editContext.target.sectionIndex != null) {
    const bgClass = extractSectionBackgroundClassFromMessage(message);
    const color = extractBackgroundColorFromMessage(message);
    if (!bgClass && !color) return null;

    return {
      planVersion: 'website-agent-v3',
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
          },
        },
      ],
    };
  }

  const contact = parseContactField(message);
  if (contact) {
    return {
      planVersion: 'website-agent-v3',
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
      planVersion: 'website-agent-v3',
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
      planVersion: 'website-agent-v3',
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
