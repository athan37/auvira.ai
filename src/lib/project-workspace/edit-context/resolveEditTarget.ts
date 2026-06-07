import {
  messageRefersToHeroStyle,
  resolveClarificationAnchorFromHistory,
  resolveEffectiveEditMessage,
  resolveExplicitSectionTarget,
} from '@/lib/chat/conversationContextForEdit';
import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';
import { resolveSectionWithCatalogLLM } from '@/lib/project-workspace/edit-shared/resolveSectionWithCatalogLLM';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/editAmbiguity';
import { resolveDeicticTargetFromFocus } from '@/lib/project-workspace/edit-shared/resolveEditFocus';
import type { EditFocusStack } from '@/lib/project-workspace/edit-shared/types';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import {
  extractExplicitSectionTitleIntent,
  extractSectionTitleCandidates,
  findBestSectionTitleMatch,
  resolveSectionTarget,
  scoreTitleMatch,
} from '@/lib/project-workspace/edit-shared/resolveSectionTarget';
import {
  matchSectionFromMessage,
  findSectionsContainingPhrase,
  type SiteSectionCatalog,
} from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import type { SiteModel } from '@/lib/project-workspace/site-model/types';
import type { EditTarget, EditTargetCandidate, EditTargetKind } from './types';
import { resolveSelectedTarget } from './resolveSelectedTarget';

function toCandidate(
  kind: EditTargetKind,
  sectionIndex: number | undefined,
  sectionType: string | undefined,
  title: string | undefined,
  confidence: 'high' | 'medium' | 'low',
  reason?: string
): EditTargetCandidate {
  return {
    kind,
    sectionIndex,
    sectionTitle: title,
    sectionType,
    confidence,
    reason,
  };
}

function heroTarget(confidence: 'high' | 'medium' | 'low', reason: string): EditTarget {
  return {
    kind: 'hero',
    confidence,
    candidates: [toCandidate('hero', undefined, undefined, undefined, confidence, reason)],
    needsClarification: false,
    reason,
  };
}

function readHeroHeadline(siteConfigContent: string): string | undefined {
  const doubleQuoted = siteConfigContent.match(/"headline"\s*:\s*"([^"]*)"/)?.[1]?.trim();
  if (doubleQuoted) return doubleQuoted;
  const singleQuoted = siteConfigContent.match(/headline\s*:\s*'((?:\\'|[^'])*)'/)?.[1]?.trim();
  if (singleQuoted) return singleQuoted.replace(/\\'/g, "'");
  return siteConfigContent.match(/\bheadline\s*:\s*"([^"]*)"/)?.[1]?.trim();
}

/** Style edits quoting the hero headline (often labeled "section" by owners) → hero target. */
function heroStyleTargetFromQuotedHeadline(
  effectiveMessage: string,
  siteModel: SiteModel,
  catalog: SiteSectionCatalog
): EditTarget | null {
  const what = classifyEditWhat(effectiveMessage);
  if (what !== 'style_background' && what !== 'style_text' && what !== 'style_card') {
    return null;
  }

  const headline = readHeroHeadline(siteModel.siteConfigContent ?? '');
  if (!headline) return null;

  const quotedTitles = extractSectionTitleCandidates(effectiveMessage);
  const matchesHeadline = quotedTitles.some(
    (title) => title.trim() === headline || scoreTitleMatch(headline, title) >= 85
  );
  if (!matchesHeadline) return null;

  // Section title beats hero when the quoted phrase lives in a content section.
  for (const title of quotedTitles) {
    const sectionHits = findSectionsContainingPhrase(title, catalog);
    if (sectionHits.some((s) => scoreTitleMatch(s.title, title) >= 85)) {
      return null;
    }
  }

  return heroTarget('high', `Quoted title matches hero headline "${headline}"`);
}

/**
 * Resolve edit target from message + catalog. Quoted titles beat deictic "this section".
 */
export function resolveEditTarget(
  message: string,
  siteModel: SiteModel,
  catalog: SiteSectionCatalog,
  history: ConversationTurn[] = [],
  editFocusStack?: EditFocusStack | null,
  selectedTarget?: SelectedTargetInput
): EditTarget {
  return resolveEditTargetSync(message, siteModel, catalog, history, editFocusStack, selectedTarget);
}

/** Sync resolver (no LLM). Prefer {@link resolveEditTargetAsync} for V3 planning. */
export function resolveEditTargetSync(
  message: string,
  siteModel: SiteModel,
  catalog: SiteSectionCatalog,
  history: ConversationTurn[] = [],
  editFocusStack?: EditFocusStack | null,
  selectedTarget?: SelectedTargetInput
): EditTarget {
  const siteConfigContent = siteModel.siteConfigContent ?? '';
  const fromSelection = resolveSelectedTarget(selectedTarget, catalog, siteConfigContent);
  if (fromSelection) {
    return fromSelection;
  }

  const explicitSection = resolveExplicitSectionTarget(message, catalog, history);
  if (explicitSection?.sectionIndex != null && explicitSection.confidence === 'high') {
    return {
      kind: 'section',
      sectionIndex: explicitSection.sectionIndex,
      sectionType: explicitSection.sectionType,
      title: explicitSection.title,
      rendererComponent: explicitSection.rendererComponent,
      confidence: 'high',
      candidates: [
        toCandidate(
          'section',
          explicitSection.sectionIndex,
          explicitSection.sectionType,
          explicitSection.title,
          'high',
          explicitSection.reason ?? 'Current-turn catalog match'
        ),
      ],
      needsClarification: false,
      reason: explicitSection.reason ?? 'Current-turn catalog match',
    };
  }

  const effectiveMessage = resolveEffectiveEditMessage(message, history, editFocusStack, selectedTarget, {
    catalog,
  });
  const lower = effectiveMessage.toLowerCase();

  const clarificationAnchor = resolveClarificationAnchorFromHistory(history, {
    currentMessage: message,
    catalog,
  });
  if (clarificationAnchor?.kind === 'hero' && styleEditNeedsSectionTarget(effectiveMessage)) {
    return heroTarget('high', 'Clarification anchor: hero');
  }
  if (
    clarificationAnchor?.kind === 'section' &&
    clarificationAnchor.sectionIndex != null &&
    styleEditNeedsSectionTarget(effectiveMessage)
  ) {
    const section = catalog.sections.find((s) => s.index === clarificationAnchor.sectionIndex);
    if (section) {
      return {
        kind: 'section',
        sectionIndex: section.index,
        sectionType: section.type,
        title: section.title,
        rendererComponent: section.rendererComponent,
        confidence: 'high',
        candidates: [
          toCandidate(
            'section',
            section.index,
            section.type,
            section.title,
            'high',
            'Clarification anchor: section'
          ),
        ],
        needsClarification: false,
        reason: 'Clarification anchor: section',
      };
    }
  }

  if (messageRefersToHeroStyle(effectiveMessage)) {
    return heroTarget('high', 'Hero style target');
  }

  const titleCandidates = extractSectionTitleCandidates(effectiveMessage);
  const hasQuotedTitle = titleCandidates.length > 0;

  const catalogMatch = matchSectionFromMessage(effectiveMessage, catalog, { history });
  if (catalogMatch?.sectionIndex != null && catalogMatch.confidence === 'high') {
    return {
      kind: 'section',
      sectionIndex: catalogMatch.sectionIndex,
      sectionType: catalogMatch.sectionType,
      title: catalogMatch.title,
      rendererComponent: catalogMatch.rendererComponent,
      confidence: 'high',
      candidates: [
        toCandidate(
          'section',
          catalogMatch.sectionIndex,
          catalogMatch.sectionType,
          catalogMatch.title,
          'high',
          catalogMatch.reason
        ),
      ],
      needsClarification: false,
      reason: catalogMatch.reason,
    };
  }

  const heroFromQuotedHeadline = heroStyleTargetFromQuotedHeadline(
    effectiveMessage,
    siteModel,
    catalog
  );
  if (heroFromQuotedHeadline) {
    return heroFromQuotedHeadline;
  }

  if (/\b(phone|email|address)\b/i.test(lower) && /\b(contact|call|reach)\b/i.test(lower)) {
    return {
      kind: 'site',
      confidence: 'high',
      candidates: [toCandidate('site', undefined, undefined, undefined, 'high', 'Contact field edit')],
      needsClarification: false,
      reason: 'Contact field edit',
    };
  }

  if (catalogMatch?.confidence === 'low' && catalogMatch.clarificationMessage) {
    const candidates: EditTargetCandidate[] =
      catalogMatch.matches?.map((m) =>
        toCandidate('section', m.index, m.type, m.title, 'low', 'Ambiguous section match')
      ) ?? [];
    return {
      kind: 'section',
      confidence: 'low',
      candidates,
      needsClarification: true,
      clarificationMessage: catalogMatch.clarificationMessage,
      suggestedReplies: catalogMatch.suggestedReplies,
      reason: 'Ambiguous section target',
    };
  }

  const titledIntent = extractExplicitSectionTitleIntent(effectiveMessage);
  if (titledIntent && styleEditNeedsSectionTarget(effectiveMessage)) {
    const best = findBestSectionTitleMatch([titledIntent], catalog.sections);
    if (!best) {
      return {
        kind: 'section',
        confidence: 'low',
        candidates: [],
        needsClarification: true,
        clarificationMessage:
          `I couldn't find a section titled "${titledIntent}". Reply with the number:\n\n` +
          catalog.sections
            .map((s, i) => `${i + 1}. [${s.index}] ${s.type} — "${s.title}"`)
            .join('\n'),
        suggestedReplies: catalog.numberedReplies,
        reason: 'Explicit section title not found',
      };
    }
  }

  const enriched = siteModel.structure;
  if (enriched) {
    const legacy = resolveSectionTarget(effectiveMessage, history, enriched, catalog);
    if (legacy.sectionIndex != null && legacy.confidence !== 'low') {
      return {
        kind: 'section',
        sectionIndex: legacy.sectionIndex,
        sectionType: legacy.sectionType,
        title: legacy.title,
        rendererComponent: legacy.rendererComponent,
        confidence: legacy.confidence,
        candidates: [
          toCandidate(
            'section',
            legacy.sectionIndex,
            legacy.sectionType,
            legacy.title,
            legacy.confidence,
            legacy.reason
          ),
        ],
        needsClarification: false,
        reason: legacy.reason,
      };
    }
    if (legacy.clarificationMessage && !hasQuotedTitle) {
      return {
        kind: 'section',
        confidence: 'low',
        candidates:
          legacy.matches?.map((m) =>
            toCandidate('section', m.index, m.type, m.title, 'low')
          ) ?? [],
        needsClarification: true,
        clarificationMessage: legacy.clarificationMessage,
        suggestedReplies: legacy.suggestedReplies,
      };
    }
  }

  const what = classifyEditWhat(effectiveMessage);
  if (
    what.startsWith('style_') &&
    /\b(this|that)\s+section\b/i.test(effectiveMessage) &&
    messageRefersToHeroStyle(effectiveMessage)
  ) {
    return heroTarget('high', 'Deictic hero section reference');
  }

  if (
    what.startsWith('style_') &&
    /\b(this|that)\s+section\b/i.test(effectiveMessage) &&
    !hasQuotedTitle
  ) {
    const fromFocus = resolveDeicticTargetFromFocus(message, editFocusStack, catalog);
    if (fromFocus && !fromFocus.needsClarification) {
      return fromFocus;
    }

    return {
      kind: 'section',
      confidence: 'low',
      candidates: catalog.sections.map((s) =>
        toCandidate('section', s.index, s.type, s.title, 'low', 'Deictic section reference')
      ),
      needsClarification: true,
      clarificationMessage:
        'Which section do you mean? Reply with the number:\n\n' +
        catalog.sections
          .map((s, i) => `${i + 1}. [${s.index}] ${s.type} — "${s.title}"`)
          .join('\n'),
      suggestedReplies: catalog.numberedReplies,
      reason: 'Deictic section without title',
    };
  }

  return {
    kind: 'site',
    confidence: 'medium',
    candidates: [],
    needsClarification: false,
    reason: 'Site-wide or unresolved target',
  };
}

function styleEditNeedsSectionTarget(message: string): boolean {
  const what = classifyEditWhat(message);
  return what === 'style_background' || what === 'style_text' || what === 'style_card';
}

/**
 * Resolve edit target with catalog LLM fallback for style edits (disable with SECTION_TARGET_LLM=0).
 */
export async function resolveEditTargetAsync(
  message: string,
  siteModel: SiteModel,
  catalog: SiteSectionCatalog,
  history: ConversationTurn[] = [],
  editFocusStack?: EditFocusStack | null,
  selectedTarget?: SelectedTargetInput
): Promise<EditTarget> {
  const target = resolveEditTarget(message, siteModel, catalog, history, editFocusStack, selectedTarget);
  const effectiveMessage = resolveEffectiveEditMessage(message, history, editFocusStack, selectedTarget);

  if (target.kind === 'hero' && target.confidence === 'high') {
    return target;
  }

  if (target.needsClarification) {
    if (selectedTarget) {
      return target;
    }
    const fromFocus = resolveDeicticTargetFromFocus(message, editFocusStack, catalog);
    if (fromFocus && !fromFocus.needsClarification) {
      return fromFocus;
    }
    return target;
  }

  if (target.kind === 'nav' || target.kind === 'footer') {
    return target;
  }

  const phraseHints = extractSectionTitleCandidates(effectiveMessage).filter(
    (p) => p.trim().length >= 8
  );
  const phraseLocated =
    phraseHints.length > 0 &&
    phraseHints.some((phrase) => findSectionsContainingPhrase(phrase, catalog).length === 1);

  const needsLlm =
    styleEditNeedsSectionTarget(effectiveMessage) &&
    !phraseLocated &&
    (target.kind === 'hero' ||
      target.kind !== 'section' ||
      target.sectionIndex == null ||
      target.confidence !== 'high');

  if (!needsLlm) {
    return target;
  }

  const llmPick = await resolveSectionWithCatalogLLM(effectiveMessage, catalog);
  if (!llmPick || llmPick.confidence === 'low') {
    return target;
  }

  const section = catalog.sections.find((s) => s.index === llmPick.sectionIndex);
  if (!section) {
    return target;
  }

  for (const phrase of phraseHints) {
    const hits = findSectionsContainingPhrase(phrase, catalog);
    if (hits.length === 1 && hits[0]!.index !== llmPick.sectionIndex) {
      return target;
    }
  }

  const titledIntent = extractExplicitSectionTitleIntent(effectiveMessage);
  if (titledIntent && scoreTitleMatch(section.title, titledIntent) < 50) {
    return target;
  }

  const catalogMatch = matchSectionFromMessage(effectiveMessage, catalog, { history });
  if (
    catalogMatch?.confidence === 'low' ||
    (catalogMatch?.sectionIndex != null &&
      catalogMatch.confidence === 'high' &&
      catalogMatch.sectionIndex !== llmPick.sectionIndex)
  ) {
    return target;
  }

  return {
    kind: 'section',
    sectionIndex: section.index,
    sectionType: section.type,
    title: section.title,
    rendererComponent: section.rendererComponent,
    confidence: llmPick.confidence === 'high' ? 'high' : 'medium',
    candidates: [
      toCandidate(
        'section',
        section.index,
        section.type,
        section.title,
        llmPick.confidence === 'high' ? 'high' : 'medium',
        llmPick.reason
      ),
    ],
    needsClarification: false,
    reason: llmPick.reason,
  };
}
