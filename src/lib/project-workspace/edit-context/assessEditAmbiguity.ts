import { hasExplicitEditTarget } from '@/lib/project-workspace/edit-shared/editTargetUtils';
import { detectScopedStyleRequest } from '@/lib/project-workspace/edit-shared/editAmbiguity';
import { extractColorsFromMessage } from '@/lib/project-workspace/edit-shared/preset/presetUtils';
import { matchSectionFromMessage } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import type { EditWhatKind } from '@/lib/project-workspace/edit-shared/types';
import { classifyEditWhat } from './classifyEditWhat';
import type { EditContext } from './types';

export type AmbiguityReason =
  | 'missing_target'
  | 'missing_what'
  | 'missing_value'
  | 'ambiguous_style_scope'
  | 'low_confidence_target'
  | 'deictic_without_pin'
  | 'compound_low_confidence';

export interface EditAmbiguityAssessment {
  blocked: boolean;
  reasons: AmbiguityReason[];
  clarificationMessage?: string;
  suggestedReplies?: string[];
  guidanceHints: string[];
}

const GUIDANCE_BY_REASON: Record<AmbiguityReason, string> = {
  missing_target:
    'Pin a section from the preview, or say "first section" / a section title in quotes.',
  missing_what:
    'Say whether you mean section **background**, **title text**, **card** styling, or **copy** changes.',
  missing_value:
    'Include the exact new value — a color name, quoted text, phone number, etc.',
  ambiguous_style_scope:
    'Specify background vs text vs card (e.g. "all testimonial card backgrounds").',
  low_confidence_target:
    'Name the section more specifically, or drag it from the preview into chat.',
  deictic_without_pin:
    '"This section" needs a pinned target — drag the section from the preview into chat.',
  compound_low_confidence:
    'This request touches several things — pick one section and one change at a time.',
};

function messageHasKeyword(message: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(message);
}

function hasStyleValue(message: string): boolean {
  return (
    extractColorsFromMessage(message).length > 0 ||
    /\b(background|gradient|colour|color)\b/i.test(message)
  );
}

function hasCopyValue(message: string): boolean {
  if (hasExplicitEditTarget(message)) return true;
  if (/\bto\s+["'][^"']+["']/i.test(message)) return true;
  if (/\b(?:phone|email|address)\b/i.test(message) && /[\d@]/.test(message)) return true;
  return false;
}

function isVagueSectionReference(message: string, catalog: EditContext['sectionCatalog']): boolean {
  if (!/\bsection\b/i.test(message)) return false;
  if (hasOrdinalOrNamedSection(message, catalog)) return false;
  if (isDeicticSectionMessage(message)) return false;
  return /\b(?:change|update|make|set)\s+(?:the\s+)?section\b/i.test(message);
}

function hasNamedSectionInMessage(message: string, catalog: EditContext['sectionCatalog']): boolean {
  const match = matchSectionFromMessage(message, catalog);
  return match?.sectionIndex != null && match.confidence !== 'low';
}

function hasOrdinalOrNamedSection(message: string, catalog: EditContext['sectionCatalog']): boolean {
  if (/\b(?:first|second|third|fourth|fifth|\d+(?:st|nd|rd|th))\s+section\b/i.test(message)) {
    return true;
  }
  const match = matchSectionFromMessage(message, catalog);
  return match?.sectionIndex != null && match.confidence === 'high';
}

function isDeicticSectionMessage(message: string): boolean {
  return /\b(this|that)\s+section\b/i.test(message.toLowerCase());
}

function hasPinOrFocus(context: EditContext): boolean {
  if (context.selectedTarget) return true;
  return (context.editFocusStack?.items?.length ?? 0) > 0;
}

function hasResolvedSectionTarget(context: EditContext): boolean {
  const { target } = context;
  if (target.needsClarification) return false;
  if (target.kind === 'hero') return target.confidence === 'high';
  if (target.sectionIndex != null && target.confidence !== 'low') return true;
  return false;
}

function buildCardScopeClarification(sectionTitle: string): Pick<
  EditAmbiguityAssessment,
  'clarificationMessage' | 'suggestedReplies'
> {
  return {
    clarificationMessage:
      `I can change styling in "${sectionTitle}", but need one detail:\n\n` +
      '1. Background of **all** cards in that section\n' +
      '2. Background of **one** specific card\n' +
      '3. **Text** color in that section\n' +
      '4. The **whole section** background\n\n' +
      'Reply with a number or describe exactly what to restyle.',
    suggestedReplies: [
      'Whole section background',
      'All card backgrounds',
      'Text color in that section',
      'One specific card',
    ],
  };
}

function vagueStructureClarification(): Pick<
  EditAmbiguityAssessment,
  'clarificationMessage' | 'suggestedReplies'
> {
  return {
    clarificationMessage:
      'What would you like to change about that section?\n\n' +
      '- **Copy** (title, body, or item text)\n' +
      '- **Background** or section styling\n' +
      '- **Structure** (add/remove items or sections)',
    suggestedReplies: [
      'Change section text/copy',
      'Change section background',
      'Add or update section content',
    ],
  };
}

/** Build user-facing clarification copy from structured reasons. */
export function formatAmbiguityClarification(
  reasons: AmbiguityReason[],
  detail?: Pick<EditAmbiguityAssessment, 'clarificationMessage' | 'suggestedReplies'>
): { message: string; suggestedReplies?: string[] } {
  if (detail?.clarificationMessage) {
    return {
      message: detail.clarificationMessage,
      suggestedReplies: detail.suggestedReplies,
    };
  }

  const bullets = reasons.map((reason) => `• ${GUIDANCE_BY_REASON[reason]}`);
  const message = [
    "Sorry — I couldn't apply that safely because your request is ambiguous.",
    '',
    "What's unclear:",
    ...bullets,
    '',
    'Try describing the section (or drag it from the preview), what to change, and the exact value.',
  ].join('\n');

  return { message, suggestedReplies: detail?.suggestedReplies };
}

function guidanceForReasons(reasons: AmbiguityReason[]): string[] {
  return [...new Set(reasons.map((reason) => GUIDANCE_BY_REASON[reason]))];
}

function hasResolvedColorReference(context: EditContext): boolean {
  return Boolean(
    context.resolvedReferences?.some(
      (ref) => ref.resolvedKind === 'color' && ref.resolvedValue?.trim()
    )
  );
}

function messageHasResolvedColor(context: EditContext, message: string): boolean {
  if (hasResolvedColorReference(context)) return true;
  return extractColorsFromMessage(message).length > 0;
}

function hasSmartDefaultStylePath(
  context: EditContext,
  what: EditWhatKind,
  message: string
): boolean {
  const styleWhat = what === 'style_background' || what === 'style_text' || what === 'style_card';
  if (!styleWhat || !hasStyleValue(message)) {
    if (!(styleWhat && hasResolvedColorReference(context))) return false;
  }
  if (messageHasKeyword(message.toLowerCase(), 'card')) return false;

  if (context.selectedTarget) {
    return (
      context.selectedTarget.kind === 'hero' ||
      context.selectedTarget.sectionIndex != null ||
      context.target.sectionIndex != null
    );
  }

  if (hasResolvedColorReference(context) && hasPinOrFocus(context)) {
    return true;
  }

  return (
    hasResolvedSectionTarget(context) &&
    hasOrdinalOrNamedSection(message, context.sectionCatalog)
  );
}

/**
 * Pre-plan gate: block unsafe edits before planning when target, what, or value is unclear.
 */
export function assessEditAmbiguity(context: EditContext): EditAmbiguityAssessment {
  const message = context.effectiveMessage;
  const lower = message.toLowerCase();
  const what = classifyEditWhat(message);
  const reasons: AmbiguityReason[] = [];
  let detail: Pick<EditAmbiguityAssessment, 'clarificationMessage' | 'suggestedReplies'> | undefined;

  const { target, riskFlags, sectionCatalog } = context;

  if (target.needsClarification && target.clarificationMessage) {
    return {
      blocked: true,
      reasons: ['missing_target'],
      clarificationMessage: target.clarificationMessage,
      suggestedReplies: target.suggestedReplies ?? sectionCatalog.numberedReplies.slice(0, 4),
      guidanceHints: guidanceForReasons(['missing_target']),
    };
  }

  if (hasSmartDefaultStylePath(context, what, message)) {
    return { blocked: false, reasons: [], guidanceHints: [] };
  }

  if (isDeicticSectionMessage(message) && !hasPinOrFocus(context) && target.confidence !== 'high') {
    reasons.push('deictic_without_pin');
    detail = {
      clarificationMessage:
        'Which section do you mean? Drag a section from the preview into chat, or reply with the number:\n\n' +
        sectionCatalog.sections
          .map((s, i) => `${i + 1}. [${s.index}] ${s.type} — "${s.title}"`)
          .join('\n'),
      suggestedReplies: sectionCatalog.numberedReplies.slice(0, 4),
    };
  }

  if (target.confidence === 'low' || target.kind === 'site') {
    const styleIntent =
      what === 'style_background' || what === 'style_text' || what === 'style_card';
    if (styleIntent && !context.selectedTarget && target.sectionIndex == null) {
      reasons.push('missing_target');
      if (!detail) {
        detail = {
          clarificationMessage:
            'Which section should I update? Say **first section**, use a title in quotes, or drag a section from the preview into chat.',
          suggestedReplies: sectionCatalog.numberedReplies.slice(0, 4),
        };
      }
    }
  }

  if (target.confidence === 'low' && !context.selectedTarget) {
    reasons.push('low_confidence_target');
  }

  if (riskFlags.compoundIntent && riskFlags.lowConfidenceTarget) {
    reasons.push('compound_low_confidence');
  }

  const hasColor = extractColorsFromMessage(message).length > 0;
  const hasCard = messageHasKeyword(lower, 'card');
  const hasSectionWord = messageHasKeyword(lower, 'section');

  if (
    hasColor &&
    hasCard &&
    !context.selectedTarget &&
    !messageHasKeyword(lower, 'background') &&
    !messageHasKeyword(lower, 'text') &&
    !/\b(?:whole|entire|full)\s+section\b/i.test(lower) &&
    (hasSectionWord || hasNamedSectionInMessage(message, sectionCatalog))
  ) {
    if (
      hasSectionWord ||
      hasResolvedSectionTarget(context) ||
      hasNamedSectionInMessage(message, sectionCatalog)
    ) {
      reasons.push('ambiguous_style_scope');
      const sectionTitle = target.title ?? 'that section';
      detail = buildCardScopeClarification(sectionTitle);
    }
  }

  if (detectScopedStyleRequest(message) && hasSectionWord && !hasCard && !messageHasKeyword(lower, 'background')) {
    reasons.push('ambiguous_style_scope');
    if (!detail) {
      detail = {
        clarificationMessage:
          'This sounds like a color or style change — can you confirm what to restyle (card backgrounds, text color, or the whole section background)?',
        suggestedReplies: [
          'Whole section background',
          'Card backgrounds in that section',
          'Text color in that section',
        ],
      };
    }
  }

  const vagueSection =
    messageHasKeyword(lower, 'section') &&
    !/\b(background|color|colour|text|copy|title|headline|body|faq|add|remove|image)\b/.test(lower) &&
    !hasExplicitEditTarget(message);

  if (
    vagueSection &&
    what === 'structure' &&
    !hasOrdinalOrNamedSection(message, sectionCatalog)
  ) {
    reasons.push('missing_what');
    if (!detail) detail = vagueStructureClarification();
  }

  const ordinalSectionChangeOnly =
    hasOrdinalOrNamedSection(message, sectionCatalog) &&
    /\b(?:change|update)\b/i.test(message) &&
    what === 'structure' &&
    !/\b(background|color|colour|copy|text|title|headline|body|add|remove|delete|image)\b/i.test(
      lower
    );

  if (ordinalSectionChangeOnly) {
    reasons.push('missing_what');
    if (!detail) detail = vagueStructureClarification();
  }

  if (what === 'copy' && !hasCopyValue(message) && !messageHasResolvedColor(context, message)) {
    reasons.push('missing_value');
    if (!detail) {
      detail = {
        clarificationMessage: 'What should the new text be? Paste the exact wording you want.',
        suggestedReplies: [],
      };
    }
  }

  const styleWhat = what === 'style_background' || what === 'style_text' || what === 'style_card';
  if (styleWhat && isVagueSectionReference(message, sectionCatalog)) {
    reasons.push('missing_target');
    if (!detail) {
      detail = {
        clarificationMessage:
          'Which section should I update? Say **first section**, use a title in quotes, or drag a section from the preview into chat.',
        suggestedReplies: sectionCatalog.numberedReplies.slice(0, 4),
      };
    }
  }

  if (styleWhat && !hasStyleValue(message) && !messageHasResolvedColor(context, message)) {
    reasons.push('missing_value');
  }

  if (
    styleWhat &&
    !hasResolvedSectionTarget(context) &&
    !context.selectedTarget &&
    !hasOrdinalOrNamedSection(message, sectionCatalog)
  ) {
    if (!reasons.includes('missing_target')) reasons.push('missing_target');
  }

  if (reasons.length === 0) {
    return { blocked: false, reasons: [], guidanceHints: [] };
  }

  const formatted = formatAmbiguityClarification(reasons, detail);
  return {
    blocked: true,
    reasons,
    clarificationMessage: formatted.message,
    suggestedReplies: formatted.suggestedReplies ?? detail?.suggestedReplies,
    guidanceHints: guidanceForReasons(reasons),
  };
}

export function defaultGuidanceHints(): string[] {
  return [
    GUIDANCE_BY_REASON.missing_target,
    GUIDANCE_BY_REASON.missing_what,
    GUIDANCE_BY_REASON.missing_value,
  ];
}

export function classifiedEditWhat(message: string): EditWhatKind {
  return classifyEditWhat(message);
}
