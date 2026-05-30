import { hasExplicitEditTarget } from './enrichEditPrompt';
import { wantsNewImageSection } from './imagePlacementIntent';
import type { ConversationTurn } from './editAmbiguity';
import { resolveEffectiveEditMessage } from '@/lib/chat/conversationContextForEdit';
import { extractEditCodeContext, formatCodeContextBlocks } from './extractEditCodeContext';
import {
  buildEnrichedSiteStructure,
  resolveSectionTarget,
} from './resolveSectionTarget';
import {
  applyCatalogMatchToTarget,
  buildSiteSectionCatalog,
  matchSectionFromMessage,
} from './siteSectionCatalog';
import { resolveSectionWithCatalogLLM } from './resolveSectionWithCatalogLLM';
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
  const hasColorSignal =
    /\b(backgrounds?|colours?|colors?)\b/.test(lower) ||
    isBackgroundColorEditRequest(message) ||
    isTextColorEditRequest(message);

  if (/\bcard\b/.test(lower) && /\b(backgrounds?|colours?|colors?)\b/.test(lower)) {
    return 'style_card';
  }

  if (
    isTextColorEditRequest(message) ||
    (/\btext\b/.test(lower) && /\b(colours?|colors?)\b/.test(lower))
  ) {
    return 'style_text';
  }

  if (
    isBackgroundColorEditRequest(message) ||
    (/\bbackgrounds?\b/.test(lower) && !/\bcard\b/.test(lower))
  ) {
    return 'style_background';
  }

  if (/\b(image|photo|picture|gallery|upload)\b/.test(lower) && !hasColorSignal) {
    return 'images';
  }

  if (
    (/\b(add|remove|delete|reorder|move|append|insert)\b/.test(lower) ||
      /\bfaq\b/.test(lower)) &&
    !/\b(background|colour|color)\b/.test(lower)
  ) {
    return 'structure';
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
  const sectionCatalog = buildSiteSectionCatalog(siteConfigContent, pageContent);
  const structureBrief = sectionCatalog.textBlock;
  const effectiveMessage = resolveEffectiveEditMessage(message, history);
  let where = resolveSectionTarget(message, history, enriched, sectionCatalog);

  if (
    where.clarificationMessage &&
    where.confidence !== 'high' &&
    !wantsNewImageSection(effectiveMessage)
  ) {
    return {
      needsClarification: true,
      clarificationMessage: where.clarificationMessage,
      suggestedReplies: where.suggestedReplies ?? sectionCatalog.numberedReplies,
      sectionCatalog,
    };
  }

  const what = classifyEditWhat(effectiveMessage);

  if (
    (what === 'style_background' || what === 'style_text' || what === 'style_card') &&
    where.kind === 'section' &&
    where.sectionIndex == null
  ) {
    const catalogMatch = matchSectionFromMessage(effectiveMessage, sectionCatalog, { history });
    if (catalogMatch?.sectionIndex != null && catalogMatch.confidence === 'high') {
      where = applyCatalogMatchToTarget(where, catalogMatch);
    } else if (catalogMatch?.confidence === 'low' && catalogMatch.clarificationMessage) {
      return {
        needsClarification: true,
        clarificationMessage: catalogMatch.clarificationMessage,
        suggestedReplies: catalogMatch.suggestedReplies ?? sectionCatalog.numberedReplies,
        sectionCatalog,
      };
    } else {
      const llmPick = await resolveSectionWithCatalogLLM(effectiveMessage, sectionCatalog);
      if (llmPick && llmPick.confidence !== 'low') {
        const section = sectionCatalog.sections.find((s) => s.index === llmPick.sectionIndex);
        if (section) {
          where = applyCatalogMatchToTarget(where, {
            confidence: llmPick.confidence === 'high' ? 'high' : 'medium',
            kind: 'section',
            sectionIndex: section.index,
            sectionType: section.type,
            title: section.title,
            rendererComponent: section.rendererComponent,
            configLineRange: section.configLineRange ?? undefined,
            pageComponentRange: section.pageComponentRange ?? undefined,
            reason: llmPick.reason,
            matches: [],
          });
        }
      }
    }

    if (where.kind === 'section' && where.sectionIndex == null) {
      return {
        needsClarification: true,
        clarificationMessage:
          where.clarificationMessage ??
          'Which section should I update? Reply with the number:\n\n' +
            sectionCatalog.sections
              .map((s, i) => `${i + 1}. [${s.index}] ${s.type} — "${s.title}"`)
              .join('\n'),
        suggestedReplies: where.suggestedReplies ?? sectionCatalog.numberedReplies,
        sectionCatalog,
      };
    }
  }
  const whatClarification = needsWhatClarification(what, effectiveMessage);
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
    ownerMessage: effectiveMessage,
  });

  const plan: EditTargetPlan = {
    where,
    what,
    valueExplicit: hasExplicitEditTarget(effectiveMessage),
    codeBlocks,
    structureBrief,
    sectionCatalog,
  };

  return { plan, sectionCatalog };
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
