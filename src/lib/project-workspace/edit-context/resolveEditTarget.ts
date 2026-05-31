import { resolveEffectiveEditMessage } from '@/lib/chat/conversationContextForEdit';
import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';
import { resolveSectionWithCatalogLLM } from '@/lib/project-workspace/edit-shared/resolveSectionWithCatalogLLM';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/editAmbiguity';
import {
  extractExplicitSectionTitleIntent,
  extractSectionTitleCandidates,
  findBestSectionTitleMatch,
  resolveSectionTarget,
  scoreTitleMatch,
} from '@/lib/project-workspace/edit-shared/resolveSectionTarget';
import {
  matchSectionFromMessage,
  type SiteSectionCatalog,
} from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import type { SiteModel } from '@/lib/project-workspace/site-model/types';
import type { EditTarget, EditTargetCandidate, EditTargetKind } from './types';

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
  const quotedKey = siteConfigContent.match(/"headline"\s*:\s*"([^"]*)"/)?.[1]?.trim();
  if (quotedKey) return quotedKey;
  return siteConfigContent.match(/\bheadline\s*:\s*"([^"]*)"/)?.[1]?.trim();
}

/** Style edits quoting the hero headline (often labeled "section" by owners) → hero target. */
function heroStyleTargetFromQuotedHeadline(
  effectiveMessage: string,
  siteModel: SiteModel
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

  return heroTarget('high', `Quoted title matches hero headline "${headline}"`);
}

/**
 * Resolve edit target from message + catalog. Quoted titles beat deictic "this section".
 */
export function resolveEditTarget(
  message: string,
  siteModel: SiteModel,
  catalog: SiteSectionCatalog,
  history: ConversationTurn[] = []
): EditTarget {
  return resolveEditTargetSync(message, siteModel, catalog, history);
}

/** Sync resolver (no LLM). Prefer {@link resolveEditTargetAsync} for V3 planning. */
export function resolveEditTargetSync(
  message: string,
  siteModel: SiteModel,
  catalog: SiteSectionCatalog,
  history: ConversationTurn[] = []
): EditTarget {
  const effectiveMessage = resolveEffectiveEditMessage(message, history);
  const lower = effectiveMessage.toLowerCase();

  if (/\b(hero|headline|tagline|subheadline)\b/i.test(lower) && !/\bsection\b/i.test(lower)) {
    return heroTarget('high', 'Hero keyword match');
  }

  const heroFromQuotedHeadline = heroStyleTargetFromQuotedHeadline(effectiveMessage, siteModel);
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
    !hasQuotedTitle
  ) {
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
 * Resolve edit target with optional catalog LLM when deterministic matching fails (SECTION_TARGET_LLM=1).
 */
export async function resolveEditTargetAsync(
  message: string,
  siteModel: SiteModel,
  catalog: SiteSectionCatalog,
  history: ConversationTurn[] = []
): Promise<EditTarget> {
  const target = resolveEditTarget(message, siteModel, catalog, history);
  const effectiveMessage = resolveEffectiveEditMessage(message, history);

  if (target.needsClarification) {
    return target;
  }

  if (target.kind === 'hero' || target.kind === 'nav' || target.kind === 'footer') {
    return target;
  }

  const needsLlm =
    styleEditNeedsSectionTarget(effectiveMessage) &&
    (target.kind !== 'section' ||
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
