import { resolveEffectiveEditMessage } from '@/lib/chat/conversationContextForEdit';
import { extractColorsFromMessage } from './preset/presetUtils';
import type { ConversationTurn } from './editAmbiguity';
import {
  buildEnrichedSiteStructure,
  extractColonSectionTitle,
  extractSectionTitleCandidates,
  findBestSectionTitleMatch,
  formatStructureMap,
  scoreTitleMatch,
  titleMatchesIntent,
  type EnrichedSectionSummary,
  type EnrichedSiteStructureSnapshot,
} from './resolveSectionTarget';
import type { SectionMatchCandidate, SectionTargetResult } from './types';

/** Canonical section list built once per edit and attached to all prompt paths. */
export interface SiteSectionCatalog {
  sections: EnrichedSectionSummary[];
  /** Prompt-safe SITE STRUCTURE MAP block. */
  textBlock: string;
  /** Numbered titles for clarification UI, e.g. "1 — Get Started Today". */
  numberedReplies: string[];
  snapshot: EnrichedSiteStructureSnapshot;
}

const ORDINAL_PATTERNS: Array<{ pattern: RegExp; index: (n: number) => number }> = [
  { pattern: /\bfirst\s+section\b/i, index: () => 0 },
  { pattern: /\bsecond\s+section\b/i, index: () => 1 },
  { pattern: /\bthird\s+section\b/i, index: () => 2 },
  { pattern: /\blast\s+section\b/i, index: (n) => Math.max(0, n - 1) },
];

const SECTION_TYPE_KEYWORDS = [
  'testimonials',
  'testimonial',
  'faq',
  'services',
  'about',
  'gallery',
  'contact',
  'generic',
  'features',
] as const;

const FUZZY_MATCH_THRESHOLD = 50;
const FUZZY_MATCH_MARGIN = 10;

function messageHasKeyword(message: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(message);
}

function extractSectionTypeKeyword(message: string): string | null {
  const lower = message.toLowerCase();
  for (const t of SECTION_TYPE_KEYWORDS) {
    if (messageHasKeyword(lower, t)) {
      return t === 'testimonial' ? 'testimonials' : t;
    }
  }
  return null;
}

/** Strip color words and styling noise so fuzzy title match compares against titles only. */
export function stripColorWordsFromMessage(message: string): string {
  let stripped = message;
  for (const color of extractColorsFromMessage(message)) {
    stripped = stripped.replace(new RegExp(`\\b${color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' ');
  }
  return stripped
    .replace(/\b(background|color|colour|section|this|that|change|update|make|to)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toMatchCandidate(section: EnrichedSectionSummary): SectionMatchCandidate {
  return {
    index: section.index,
    type: section.type,
    title: section.title,
    rendererComponent: section.rendererComponent,
  };
}

function sectionTarget(
  section: EnrichedSectionSummary,
  confidence: SectionTargetResult['confidence'],
  reason: string
): SectionTargetResult {
  return {
    confidence,
    kind: 'section',
    sectionIndex: section.index,
    sectionType: section.type,
    title: section.title,
    rendererComponent: section.rendererComponent,
    configLineRange: section.configLineRange ?? undefined,
    pageComponentRange: section.pageComponentRange ?? undefined,
    reason,
    matches: [],
  };
}

function buildClarificationFromCatalog(catalog: SiteSectionCatalog): Pick<
  SectionTargetResult,
  'clarificationMessage' | 'suggestedReplies'
> {
  return {
    clarificationMessage:
      'Which section do you mean? Reply with the number:\n\n' +
      catalog.sections
        .map((s, i) => `${i + 1}. [${s.index}] ${s.type} — "${s.title}"`)
        .join('\n'),
    suggestedReplies: catalog.numberedReplies,
  };
}

export function buildSiteSectionCatalogFromSnapshot(
  snapshot: EnrichedSiteStructureSnapshot
): SiteSectionCatalog {
  return {
    sections: snapshot.sections,
    textBlock: formatStructureMap(snapshot),
    numberedReplies: buildSectionSuggestedReplies(snapshot.sections),
    snapshot,
  };
}

/**
 * Build the canonical section catalog from siteConfig and page source.
 */
export function buildSiteSectionCatalog(
  siteConfigContent: string,
  pageContent: string
): SiteSectionCatalog {
  const snapshot = buildEnrichedSiteStructure(siteConfigContent, pageContent);
  return buildSiteSectionCatalogFromSnapshot(snapshot);
}

/** Stable prompt block for LLM / clarifier injection. */
export function formatSectionCatalogForPrompt(catalog: SiteSectionCatalog): string {
  return catalog.textBlock;
}

/** Clarifier-oriented block with explicit index/title guidance. */
export function formatSectionCatalogForClarifier(catalog: SiteSectionCatalog): string {
  const lines = [
    'AVAILABLE HOMEPAGE SECTIONS (use these indices/titles — do not guess):',
  ];
  for (const s of catalog.sections) {
    lines.push(`  [${s.index}] ${s.type} — "${s.title}"`);
  }
  return lines.join('\n');
}

/** Numbered section titles for clarification suggested replies. */
export function buildSectionSuggestedReplies(sections: EnrichedSectionSummary[]): string[] {
  return sections.map((s, i) => `${i + 1} — ${s.title}`);
}

export interface CatalogMatchOptions {
  history?: ConversationTurn[];
  /** When true, skip deictic-only low-confidence path (caller handles clarification). */
  fuzzyOnly?: boolean;
}

/**
 * Match owner message against the full section catalog (ordinals, titles, types, fuzzy).
 */
export function matchSectionFromMessage(
  message: string,
  catalog: SiteSectionCatalog,
  options: CatalogMatchOptions = {}
): SectionTargetResult | null {
  const history = options.history ?? [];
  const effectiveMessage = resolveEffectiveEditMessage(message, history);
  const { sections, snapshot } = catalog;

  for (const { pattern, index } of ORDINAL_PATTERNS) {
    if (pattern.test(effectiveMessage) && sections.length > 0) {
      const idx = index(sections.length);
      const section = sections[idx];
      if (section) {
        return sectionTarget(section, 'high', `Ordinal match: ${pattern.source}`);
      }
    }
  }

  const titleCandidates = extractSectionTitleCandidates(effectiveMessage);
  const bestTitle = findBestSectionTitleMatch(titleCandidates, sections);
  if (bestTitle) {
    return sectionTarget(
      bestTitle.section as EnrichedSectionSummary,
      'high',
      `Title match (${bestTitle.score}): "${bestTitle.intent}"`
    );
  }

  const quoted = titleCandidates[0];
  if (quoted) {
    const matches = sections.filter((s) => titleMatchesIntent(s.title, quoted));
    if (matches.length === 1) {
      return sectionTarget(matches[0]!, 'high', `Title match: "${quoted}"`);
    }
    if (matches.length > 1) {
      const candidates = matches.map(toMatchCandidate);
      return {
        confidence: 'low',
        kind: 'section',
        matches: candidates,
        clarificationMessage:
          'I found two sections that could match. Reply with the number:\n\n' +
          candidates
            .map((m, i) => `${i + 1}. [${m.index}] ${m.type} — "${m.title}"`)
            .join('\n'),
        suggestedReplies: candidates.map((m, i) => `${i + 1} — ${m.title}`),
      };
    }
  }

  const colonTitle = extractColonSectionTitle(effectiveMessage);
  if (colonTitle) {
    const matches = sections.filter((s) => titleMatchesIntent(s.title, colonTitle));
    if (matches.length === 1) {
      return sectionTarget(matches[0]!, 'high', `Colon title match: "${colonTitle}"`);
    }
  }

  const typeKeyword = extractSectionTypeKeyword(effectiveMessage);
  if (typeKeyword) {
    const matches = sections.filter((s) => s.type === typeKeyword);
    if (matches.length === 1) {
      return sectionTarget(matches[0]!, 'high', `Type keyword: ${typeKeyword}`);
    }
    if (matches.length > 1) {
      const candidates = matches.map(toMatchCandidate);
      return {
        confidence: 'low',
        kind: 'section',
        matches: candidates,
        clarificationMessage:
          'I found multiple sections of that type. Reply with the number:\n\n' +
          candidates
            .map((m, i) => `${i + 1}. [${m.index}] ${m.type} — "${m.title}"`)
            .join('\n'),
        suggestedReplies: candidates.map((m, i) => `${i + 1} — ${m.title}`),
      };
    }
  }

  const stripped = stripColorWordsFromMessage(effectiveMessage);
  if (stripped.length >= 8) {
    const scored = sections
      .map((section) => ({
        section,
        score: scoreTitleMatch(section.title, stripped),
      }))
      .filter((entry) => entry.score >= FUZZY_MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 1) {
      return sectionTarget(
        scored[0]!.section,
        'high',
        `Catalog fuzzy match (${scored[0]!.score}): "${stripped}"`
      );
    }
    if (scored.length >= 2) {
      const [best, second] = scored;
      if (best!.score - second!.score >= FUZZY_MATCH_MARGIN) {
        return sectionTarget(
          best!.section,
          'high',
          `Catalog fuzzy match (${best!.score}, margin ${best!.score - second!.score})`
        );
      }
    }
  }

  if (options.fuzzyOnly) {
    return null;
  }

  const lower = effectiveMessage.toLowerCase();
  const isDeicticStyle =
    (/\b(this|that)\b/i.test(effectiveMessage) &&
      /\b(background|color|colour|card|text)\b/i.test(lower)) ||
    /\b(this|that)\s+section\b/i.test(effectiveMessage);

  if (isDeicticStyle && titleCandidates.length === 0 && !colonTitle) {
    return {
      confidence: 'low',
      kind: 'section',
      matches: sections.map(toMatchCandidate),
      ...buildClarificationFromCatalog(catalog),
    };
  }

  void snapshot;
  return null;
}

/** Merge a catalog match into an existing SectionTargetResult when index was unresolved. */
export function applyCatalogMatchToTarget(
  where: SectionTargetResult,
  match: SectionTargetResult
): SectionTargetResult {
  if (where.sectionIndex != null || match.sectionIndex == null) {
    return where;
  }
  return {
    ...where,
    ...match,
    matches: (match.matches?.length ?? 0) > 0 ? match.matches : where.matches,
    clarificationMessage: match.confidence === 'high' ? undefined : match.clarificationMessage,
    suggestedReplies: match.confidence === 'high' ? undefined : match.suggestedReplies,
  };
}
