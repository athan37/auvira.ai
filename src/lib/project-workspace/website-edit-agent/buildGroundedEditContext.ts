import { hasExplicitEditTarget } from './enrichEditPrompt';
import { wantsNewImageSection } from './imagePlacementIntent';
import type { ConversationTurn } from './editAmbiguity';
import { extractEditCodeContext, formatCodeContextBlocks } from './extractEditCodeContext';
import {
  buildEnrichedSiteStructure,
  formatStructureMap,
  resolveSectionTarget,
} from './resolveSectionTarget';
import type { SiteWorkspaceSnapshot } from './resolveSiteWorkspace';
import {
  isBackgroundColorEditRequest,
  isTextColorEditRequest,
} from '../verifyPreviewHints';
import type {
  EditTargetPlan,
  EditWhatKind,
  GroundedEditContextResult,
  SectionTargetResult,
} from './types';

function messageHasKeyword(message: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(message);
}

/** Classify WHAT the owner wants to change from the message. */
export function classifyEditWhat(message: string): EditWhatKind {
  const lower = message.toLowerCase();

  if (/\b(image|photo|picture|gallery|upload)\b/.test(lower)) {
    return 'images';
  }

  if (
    (/\b(add|remove|delete|reorder|move|append|insert)\b/.test(lower) ||
      /\bfaq\b/.test(lower)) &&
    !/\b(background|colour|color)\b/.test(lower)
  ) {
    return 'structure';
  }

  if (/\bcard\b/.test(lower) && /\b(color|colour|background)\b/.test(lower)) {
    return 'style_card';
  }

  if (
    isTextColorEditRequest(message) ||
    (/\btext\b/.test(lower) && /\b(color|colour)\b/.test(lower))
  ) {
    return 'style_text';
  }

  if (
    isBackgroundColorEditRequest(message) ||
    (/\bbackground\b/.test(lower) && !/\bcard\b/.test(lower))
  ) {
    return 'style_background';
  }

  if (
    /\b(text|copy|headline|title|body|wording|rename|edit)\b/.test(lower) ||
    hasExplicitEditTarget(message)
  ) {
    return 'copy';
  }

  if (messageHasKeyword(lower, 'section')) {
    return 'structure';
  }

  return 'structure';
}

function buildResolvedTargetSummary(plan: EditTargetPlan): string {
  const { where, what } = plan;
  const lines = ['RESOLVED EDIT TARGET:'];

  if (where.kind === 'hero') {
    lines.push(`  Hero — change: ${what}`);
  } else if (where.kind === 'nav') {
    lines.push(`  Navigation — change: ${what}`);
  } else if (where.kind === 'footer') {
    lines.push(`  Footer — change: ${what}`);
  } else if (where.sectionIndex != null) {
    lines.push(
      `  Section [${where.sectionIndex}] ${where.sectionType ?? 'unknown'} — "${where.title ?? ''}" — change: ${what}`
    );
    if (where.rendererComponent) {
      lines.push(`  Renderer: ${where.rendererComponent} in src/app/page.tsx`);
    }
  } else {
    lines.push(`  (unresolved section) — change: ${what}`);
  }

  return lines.join('\n');
}

export function formatEditTargetPlanForPrompt(plan: EditTargetPlan): string {
  return [
    plan.structureBrief,
    '',
    buildResolvedTargetSummary(plan),
    '',
    'EXTRACTED CODE (edit these regions):',
    formatCodeContextBlocks(plan.codeBlocks),
  ].join('\n');
}

function needsWhatClarification(what: EditWhatKind, message: string): GroundedEditContextResult | null {
  const lower = message.toLowerCase();
  const vagueSection =
    messageHasKeyword(lower, 'section') &&
    !/\b(background|color|colour|text|copy|title|headline|body|faq|add|remove|image)\b/.test(
      lower
    ) &&
    !hasExplicitEditTarget(message);

  if (vagueSection && what === 'structure') {
    return {
      needsClarification: true,
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

  if (what === 'copy' && !hasExplicitEditTarget(message)) {
    return {
      needsClarification: true,
      clarificationMessage: 'What should the new text be? Paste the exact wording you want.',
      suggestedReplies: [],
    };
  }

  return null;
}

/**
 * Pre-flight grounding: section map, target resolution, code block extraction.
 */
export async function buildGroundedEditContext(
  snap: SiteWorkspaceSnapshot | null,
  message: string,
  history: ConversationTurn[] = [],
  workspacePath = ''
): Promise<GroundedEditContextResult> {
  if (!snap || snap.mode !== 'gitlab') {
    return { plan: undefined };
  }

  const siteConfigContent = snap.siteConfigContent ?? '';
  const pageContent = snap.pageContent ?? '';
  if (!siteConfigContent || !pageContent) {
    return { plan: undefined };
  }

  const enriched = buildEnrichedSiteStructure(siteConfigContent, pageContent);
  const structureBrief = formatStructureMap(enriched);
  const where = resolveSectionTarget(message, history, enriched);

  if (
    where.clarificationMessage &&
    where.confidence !== 'high' &&
    !wantsNewImageSection(message)
  ) {
    return {
      needsClarification: true,
      clarificationMessage: where.clarificationMessage,
      suggestedReplies: where.suggestedReplies,
    };
  }

  const what = classifyEditWhat(message);

  if (
    (what === 'style_background' || what === 'style_text' || what === 'style_card') &&
    where.kind === 'section' &&
    where.sectionIndex == null
  ) {
    return {
      needsClarification: true,
      clarificationMessage:
        where.clarificationMessage ??
        'Which section should I update? Reply with the section title in quotes, or say "first section".',
      suggestedReplies: where.suggestedReplies,
    };
  }
  const whatClarification = needsWhatClarification(what, message);
  if (whatClarification) {
    return whatClarification;
  }

  const codeBlocks = await extractEditCodeContext({
    target: where,
    siteConfigContent,
    pageContent,
    snapshot: enriched,
    workspacePath,
    mode: snap.mode,
    ownerMessage: message,
  });

  const plan: EditTargetPlan = {
    where,
    what,
    valueExplicit: hasExplicitEditTarget(message),
    codeBlocks,
    structureBrief,
  };

  return { plan };
}

/** Adjust WHERE confidence when WHAT is ambiguous (medium confidence). */
export function adjustTargetConfidenceForWhat(
  where: SectionTargetResult,
  what: EditWhatKind
): SectionTargetResult {
  if (where.confidence !== 'high' && where.confidence !== 'medium') {
    return where;
  }

  const styleWhat = what === 'style_background' || what === 'style_text' || what === 'style_card';
  if (styleWhat && where.kind === 'section') {
    return { ...where, confidence: where.confidence === 'high' ? 'medium' : where.confidence };
  }

  return where;
}
