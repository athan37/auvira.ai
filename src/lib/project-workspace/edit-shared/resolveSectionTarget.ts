import {
  analyzeSiteStructureForImages,
  buildStructureBriefForPlanner,
  type SiteStructureSnapshot,
  type SiteSectionSummary,
} from './siteStructureAnalysis';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import type { ConversationTurn } from './editAmbiguity';
import { wantsNewImageSection } from './imagePlacementIntent';
import { resolveEffectiveEditMessage } from '@/lib/chat/conversationContextForEdit';
import {
  buildSiteSectionCatalogFromSnapshot,
  matchSectionFromMessage,
  type SiteSectionCatalog,
} from './siteSectionCatalog';
import type {
  LineRange,
  SectionMatchCandidate,
  SectionTargetKind,
  SectionTargetResult,
} from './types';

export interface EnrichedSectionSummary extends SiteSectionSummary {
  rendererComponent: string;
  configLineRange: LineRange | null;
  pageComponentRange: LineRange | null;
  /** Title, body, and item copy — used for phrase-in-section lookup. */
  searchText?: string;
}

export interface EnrichedSiteStructureSnapshot extends SiteStructureSnapshot {
  sections: EnrichedSectionSummary[];
  structureMap: string;
}

const TYPE_TO_COMPONENT: Record<string, string> = {
  services: 'ServicesSection',
  about: 'AboutSection',
  testimonials: 'TestimonialsSection',
  testimonial: 'TestimonialsSection',
  faq: 'FaqSection',
  gallery: 'GallerySection',
  generic: 'GenericSection',
  contact: 'ContactSection',
  features: 'FeaturesSection',
};

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

function messageHasKeyword(message: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(message);
}

/** Fuzzy match score (0–100) between a section title and user intent. */
export function scoreTitleMatch(sectionTitle: string, intent: string): number {
  const t = sectionTitle.toLowerCase().trim();
  const i = intent.toLowerCase().trim();
  if (!t || !i) return 0;
  if (t === i) return 100;

  const shorter = t.length <= i.length ? t : i;
  const longer = t.length > i.length ? t : i;
  if (longer.includes(shorter)) {
    if (!shorter.includes(' ') && shorter.length < 12) return 0;
    if (shorter.length >= 12 || shorter.includes(' ')) return 85;
    return 55;
  }

  const tWords = new Set(t.split(/\W+/).filter((w) => w.length > 2));
  const iWords = i.split(/\W+/).filter((w) => w.length > 2);
  if (iWords.length === 0) return 0;
  let overlap = 0;
  for (const w of iWords) {
    if (tWords.has(w)) overlap += 1;
  }
  return Math.round((overlap / iWords.length) * 70);
}

/** Fuzzy match between section title and user intent (shared with image pipeline). */
export function titleMatchesIntent(title: string, intent: string): boolean {
  return scoreTitleMatch(title, intent) >= 50;
}

/** Extract possible section titles from owner phrasing (quotes, colon suffix, etc.). */
export function extractSectionTitleCandidates(message: string): string[] {
  const candidates: string[] = [];

  const colon = message.match(/:\s*([^:\n"']{3,120})\s*$/);
  if (colon?.[1]) candidates.push(colon[1].trim());

  const copyValueEdit =
    /\b(title|headline|text|copy|wording|rename|name)\b/i.test(message) &&
    /\bto\s+["']/i.test(message);

  if (!copyValueEdit) {
    for (const match of message.matchAll(/"([^"\\]|\\.)*"/g)) {
      const inner = match[0].slice(1, -1).trim();
      if (inner.length >= 3) candidates.push(inner);
    }
    for (const match of message.matchAll(/'([^'\\]|\\.)*'/g)) {
      const inner = match[0].slice(1, -1).trim();
      if (inner.length >= 3) candidates.push(inner);
    }
  }

  const quotedSectionTitle = message.match(
    /(?:change|update|edit|make|set)\s+(?:the\s+)?(?:color|colour|background|style|gradient|card|text|copy|wording|of)\s+(?:of\s+)?(?:the\s+)?["']([^"'\n]{3,160})["']\s+section\b/i
  );
  if (quotedSectionTitle?.[1]) {
    candidates.push(quotedSectionTitle[1].trim());
  }

  const unquotedSectionTitle = message.match(
    /(?:change|update|edit|make|set)\s+(?:the\s+)?(?:color|colour|background|style|gradient|card|text|copy|wording|of)\s+(?:of\s+)?(?:the\s+)?([^"'\n,]{8,160}?)\s+section\b/i
  );
  if (unquotedSectionTitle?.[1]) {
    const title = unquotedSectionTitle[1].trim();
    if (
      title.split(/\s+/).filter(Boolean).length >= 2 &&
      !/\bsection\b/i.test(title)
    ) {
      candidates.push(title);
    }
  }

  const titledQuoted = message.match(
    /\b(?:section|heading)\s+(?:titled|called|named)\s+["']([^"'\n]{2,120})["']/i
  );
  if (titledQuoted?.[1]) candidates.push(titledQuoted[1].trim());

  const titledUnquoted = message.match(
    /\b(?:section|heading)\s+(?:titled|called|named)\s+([^"'\n,]{2,80}?)(?:\s+to\b|,|\s*$)/i
  );
  if (titledUnquoted?.[1]) candidates.push(titledUnquoted[1].trim());

  const titled = message.match(
    /\b(?:section|heading)\s+(?:titled|called|named)\s+["']?([^"'\n]{3,120})["']?\s*$/i
  );
  if (titled?.[1]) candidates.push(titled[1].trim());

  // Unquoted title suffix after gradient phrasing: "to color gradient Grow Title Here"
  const unquotedAfterGradient = message.match(
    /\bto\s+(?:(?:color|colour|gradient|background|a|an|the)\s+)+([^:\n"']{8,120})\s*$/i
  );
  if (unquotedAfterGradient?.[1]) {
    const title = unquotedAfterGradient[1].trim();
    if (title.split(/\s+/).filter(Boolean).length >= 2) {
      candidates.push(title);
    }
  }

  // Unquoted title suffix after explicit color: "to blue Everything You Need..."
  const unquotedAfterColor = message.match(
    /\bto\s+(?:(?:color|colour|gradient|background|a|an|the)\s+)*(?:(?:light|dark|deep|pale|soft)\s+)?([a-z]+(?:-\d{2,3})?)\s+([^:\n"']{8,120})\s*$/i
  );
  if (unquotedAfterColor?.[2]) {
    const colorToken = unquotedAfterColor[1]!.toLowerCase();
    if (!['color', 'colour', 'gradient', 'background'].includes(colorToken)) {
      candidates.push(unquotedAfterColor[2].trim());
    }
  }

  if (/\bwhat our customers say\b/i.test(message)) {
    candidates.push('What Our Customers Say');
  }

  const namedBeforeField = message.match(
    /\b(?:change|update|edit|rename|set)\s+(?:the\s+)?(?:"([^"\n]+)"|'([^'\n]+)'|(.+?))\s+section\s+(?:title|headline|text|copy|body)\b/i
  );
  if (namedBeforeField) {
    const title = namedBeforeField[1] ?? namedBeforeField[2] ?? namedBeforeField[3];
    if (title?.trim()) candidates.push(title.trim());
  }

  const fieldBeforeName = message.match(
    /\b(?:change|update|edit|rename|set)\s+(?:the\s+)?section\s+(?:title|headline|text|copy|body)\s+(?:of|for)\s+(?:"([^"\n]+)"|'([^'\n]+)'|(.+?))\s+to\b/i
  );
  if (fieldBeforeName) {
    const title = fieldBeforeName[1] ?? fieldBeforeName[2] ?? fieldBeforeName[3];
    if (title?.trim()) candidates.push(title.trim());
  }

  return [...new Set(candidates.filter(Boolean))];
}

/** Extract an explicit "section titled …" intent (handles trailing "to {color}" suffixes). */
export function extractExplicitSectionTitleIntent(message: string): string | null {
  const quoted = message.match(
    /\b(?:section|heading)\s+(?:titled|called|named)\s+["']([^"'\n]{2,120})["']/i
  );
  if (quoted?.[1]?.trim()) return quoted[1].trim();

  const unquoted = message.match(
    /\b(?:section|heading)\s+(?:titled|called|named)\s+([^"'\n,]{2,80}?)(?:\s+to\b|,|\s*$)/i
  );
  if (unquoted?.[1]?.trim()) return unquoted[1].trim();

  const endAnchored = message.match(
    /\b(?:section|heading)\s+(?:titled|called|named)\s+["']?([^"'\n]{3,120})["']?\s*$/i
  );
  return endAnchored?.[1]?.trim() ?? null;
}

export type SectionCopyField = 'title' | 'body';

export interface SectionTitleCopyEditIntent {
  /** Section title phrase from the owner message (matched against catalog). */
  sectionTitleHint: string;
  field: SectionCopyField;
  value: string;
}

function mapSectionCopyField(token: string): SectionCopyField {
  return /\b(body|text|copy)\b/i.test(token) ? 'body' : 'title';
}

/**
 * Parse "{Section Name} section title to {value}" and "section title of {name} to {value}" copy edits.
 */
export function parseSectionTitleCopyEdit(message: string): SectionTitleCopyEditIntent | null {
  const namedBeforeField = message.match(
    /\b(?:change|update|edit|rename|set)\s+(?:the\s+)?(?:"([^"\n]+)"|'([^'\n]+)'|(.+?))\s+section\s+(title|headline|text|copy|body)\s+to\s+(.+?)\s*$/i
  );
  if (namedBeforeField) {
    const sectionTitleHint = (
      namedBeforeField[1] ??
      namedBeforeField[2] ??
      namedBeforeField[3] ??
      ''
    ).trim();
    const value = namedBeforeField[5]?.trim() ?? '';
    if (sectionTitleHint && value) {
      return {
        sectionTitleHint,
        field: mapSectionCopyField(namedBeforeField[4] ?? 'title'),
        value,
      };
    }
  }

  const fieldBeforeName = message.match(
    /\b(?:change|update|edit|rename|set)\s+(?:the\s+)?section\s+(title|headline|text|copy|body)\s+(?:of|for)\s+(?:"([^"\n]+)"|'([^'\n]+)'|(.+?))\s+to\s+(.+?)\s*$/i
  );
  if (fieldBeforeName) {
    const sectionTitleHint = (
      fieldBeforeName[2] ??
      fieldBeforeName[3] ??
      fieldBeforeName[4] ??
      ''
    ).trim();
    const value = fieldBeforeName[5]?.trim() ?? '';
    if (sectionTitleHint && value) {
      return {
        sectionTitleHint,
        field: mapSectionCopyField(fieldBeforeName[1] ?? 'title'),
        value,
      };
    }
  }

  return null;
}

export function findBestSectionTitleMatch<T extends SiteSectionSummary>(
  titleCandidates: string[],
  sections: T[]
): { section: T; intent: string; score: number } | null {
  let best: { section: T; intent: string; score: number } | null = null;
  for (const intent of titleCandidates) {
    for (const section of sections) {
      const score = scoreTitleMatch(section.title, intent);
      if (score >= 50 && (!best || score > best.score)) {
        best = { section, intent, score };
      }
    }
  }
  return best;
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function inferRendererComponent(type: string, pageContent: string): string {
  const normalized = type.toLowerCase();
  const fromMap = TYPE_TO_COMPONENT[normalized];
  if (fromMap && pageContent.includes(`function ${fromMap}`)) {
    return fromMap;
  }
  const pascal = normalized.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase());
  const guessed = `${pascal}Section`;
  if (pageContent.includes(`function ${guessed}`)) return guessed;
  return fromMap ?? guessed;
}

/** Extract `function ComponentName` block start/end line numbers. */
export function extractSectionComponentRange(
  pageContent: string,
  componentName: string
): LineRange | null {
  const marker = `function ${componentName}`;
  const startIdx = pageContent.indexOf(marker);
  if (startIdx < 0) return null;
  const after = pageContent.slice(startIdx);
  const endMatch = after.match(/\nfunction [A-Z]/);
  const endIdx = endMatch?.index != null ? startIdx + endMatch.index : pageContent.length;
  return {
    startLine: lineNumberAt(pageContent, startIdx),
    endLine: lineNumberAt(pageContent, endIdx),
  };
}

/** Find approximate line range for sections[i] in siteConfig source. */
export function findSiteConfigSectionLineRange(
  siteConfigContent: string,
  sectionIndex: number
): LineRange | null {
  const ranges = findSectionObjectRanges(siteConfigContent);
  return ranges[sectionIndex] ?? null;
}

/** Line ranges for every object in siteConfig.sections array. */
export function findSectionObjectRanges(siteConfigContent: string): LineRange[] {
  const sectionsIdx = siteConfigContent.indexOf('sections');
  if (sectionsIdx < 0) return [];
  const arrayStart = siteConfigContent.indexOf('[', sectionsIdx);
  if (arrayStart < 0) return [];

  const ranges: LineRange[] = [];
  let depth = 0;
  let inString: string | null = null;
  let escape = false;
  let objectStart = -1;

  for (let i = arrayStart; i < siteConfigContent.length; i++) {
    const ch = siteConfigContent[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) objectStart = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        ranges.push({
          startLine: lineNumberAt(siteConfigContent, objectStart),
          endLine: lineNumberAt(siteConfigContent, i + 1),
        });
        objectStart = -1;
      }
    } else if (ch === ']' && depth === 0) {
      break;
    }
  }

  return ranges;
}

/** Extract `function ComponentName { … }` source from page.tsx. */
export function extractSectionComponentSource(
  pageContent: string,
  componentName: string
): { content: string } | null {
  const marker = `function ${componentName}`;
  const startIdx = pageContent.indexOf(marker);
  if (startIdx < 0) return null;
  const after = pageContent.slice(startIdx);
  const endMatch = after.match(/\nfunction [A-Z]/);
  const endIdx = endMatch?.index != null ? startIdx + endMatch.index : pageContent.length;
  return { content: pageContent.slice(startIdx, endIdx) };
}
function formatStructureMapLines(
  sections: EnrichedSectionSummary[],
  siteConfigContent?: string
): string {
  const lines: string[] = ['SITE STRUCTURE MAP:'];
  if (sections.length === 0) {
    lines.push('  (no siteConfig.sections — hero/nav/footer may be hardcoded)');
  } else {
    for (const s of sections) {
      const bodyPreview = sectionBodyPreviewFromConfig(s.index, siteConfigContent);
      lines.push(
        `  [${s.index}] type="${s.type}" title="${s.title}"${bodyPreview ? ` body="${bodyPreview}"` : ''} → ${s.rendererComponent}`
      );
    }
  }
  return lines.join('\n');
}

function sectionBodyPreviewFromConfig(sectionIndex: number, siteConfigContent?: string): string | null {
  if (!siteConfigContent) return null;
  const body = parseSiteConfigSource(siteConfigContent)?.sections?.[sectionIndex]?.body;
  if (!body || typeof body !== 'string') return null;
  const trimmed = body.trim();
  if (!trimmed) return null;
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
}

/**
 * Build enriched site structure (section map + renderer + line ranges) for all edits.
 */
function buildSectionSearchText(
  sectionIndex: number,
  siteConfigContent: string,
  pageContent: string,
  rendererComponent: string
): string {
  const parts: string[] = [];
  const configSection = parseSiteConfigSource(siteConfigContent)?.sections?.[sectionIndex];
  if (configSection?.title) parts.push(String(configSection.title));
  if (configSection?.body) parts.push(String(configSection.body));
  for (const item of configSection?.items ?? []) {
    if (item.title) parts.push(String(item.title));
    if (item.description) parts.push(String(item.description));
  }
  const componentSource = extractSectionComponentSource(pageContent, rendererComponent);
  if (componentSource?.content) {
    parts.push(componentSource.content.replace(/\{section\.title\}/g, String(configSection?.title ?? '')));
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function buildEnrichedSiteStructure(
  siteConfigContent: string,
  pageContent: string
): EnrichedSiteStructureSnapshot {
  const base = analyzeSiteStructureForImages(siteConfigContent, pageContent);
  const sections: EnrichedSectionSummary[] = base.sections.map((s) => {
    const rendererComponent = inferRendererComponent(s.type, pageContent);
    return {
      ...s,
      rendererComponent,
      configLineRange: findSiteConfigSectionLineRange(siteConfigContent, s.index),
      pageComponentRange: extractSectionComponentRange(pageContent, rendererComponent),
      searchText: buildSectionSearchText(s.index, siteConfigContent, pageContent, rendererComponent),
    };
  });

  const structureMap = formatStructureMapLines(sections, siteConfigContent);

  return {
    ...base,
    sections,
    structureMap,
  };
}

/** Human-readable section map for prompts and clarification. */
export function formatStructureMap(
  snapshot: Pick<EnrichedSiteStructureSnapshot, 'sections'>,
  siteConfigContent?: string
): string {
  return formatStructureMapLines(snapshot.sections, siteConfigContent);
}

export function buildStructureBrief(snapshot: EnrichedSiteStructureSnapshot): string {
  return buildStructureBriefForPlanner(snapshot);
}

function extractQuotedTitle(message: string): string | null {
  return extractSectionTitleCandidates(message)[0] ?? null;
}

/** Title after a colon, e.g. "change this to red: Everything You Need to Grow". */
export function extractColonSectionTitle(message: string): string | null {
  const colon = message.match(/:\s*([^:\n]{3,80})\s*$/);
  return colon?.[1]?.trim() ?? null;
}

function resolveTitleIntent(
  titleIntent: string,
  snapshot: EnrichedSiteStructureSnapshot,
  reason: string
): SectionTargetResult {
  const matches = snapshot.sections.filter((s) => titleMatchesIntent(s.title, titleIntent));
  if (matches.length === 1) {
    return sectionTarget(matches[0]!, 'high', reason);
  }
  if (matches.length > 1) {
    const candidates = matches.map(toMatchCandidate);
    return {
      confidence: 'low',
      kind: 'section',
      matches: candidates,
      ...buildMultipleMatchClarification(candidates),
    };
  }
  return unresolvedTarget(snapshot, {
    clarificationMessage:
      `I couldn't find a section titled "${titleIntent}". Reply with the number from your site:\n\n` +
      snapshot.sections.map((s, i) => `${i + 1}. [${s.index}] ${s.type} — "${s.title}"`).join('\n'),
    suggestedReplies: snapshot.sections.map((s, i) => `${i + 1} — ${s.title}`),
  });
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

function detectSpecialTarget(message: string): SectionTargetKind | null {
  const lower = message.toLowerCase();
  if (messageHasKeyword(lower, 'hero')) return 'hero';
  if (/\b(nav|menu|navigation)\b/.test(lower)) return 'nav';
  if (/\bfooter\b/.test(lower)) return 'footer';
  return null;
}

import {
  extractSectionPickFromListReply,
  lastSectionListAssistantTurn,
  wasSectionListClarificationAsked,
  wasTestimonialCardClarificationAsked,
} from '@/lib/chat/conversationContextForEdit';

export { wasSectionListClarificationAsked };
function resolveNumberedSectionReply(
  message: string,
  history: ConversationTurn[],
  snapshot: EnrichedSiteStructureSnapshot
): SectionTargetResult | null {
  if (!wasSectionListClarificationAsked(history)) return null;
  if (wasTestimonialCardClarificationAsked(history) && /^[1-3]\b/.test(message.trim())) {
    return null;
  }
  const match = message.trim().match(/^([1-9])\b/);
  if (!match) return null;

  const pick = parseInt(match[1], 10);
  const assistant = lastSectionListAssistantTurn(history);
  const pickInfo = assistant
    ? extractSectionPickFromListReply(assistant.content, pick)
    : null;

  const section =
    pickInfo != null
      ? snapshot.sections.find((s) => s.index === pickInfo.sectionIndex)
      : snapshot.sections[pick - 1];

  if (!section) return null;
  return sectionTarget(
    section,
    'high',
    pickInfo
      ? `Owner picked list item ${pick} → sections[${pickInfo.sectionIndex}] "${pickInfo.title}".`
      : `Owner picked section ${pick} from clarification list.`
  );
}

function buildMultipleMatchClarification(
  matches: SectionMatchCandidate[]
): Pick<SectionTargetResult, 'clarificationMessage' | 'suggestedReplies'> {
  const lines = [
    'I found two sections that could match. Reply with the number:',
    '',
  ];
  const suggestedReplies: string[] = [];
  matches.forEach((m, i) => {
    lines.push(`${i + 1}. [${m.index}] ${m.type} — "${m.title}"`);
    suggestedReplies.push(`${i + 1} — ${m.title}`);
  });
  return {
    clarificationMessage: lines.join('\n'),
    suggestedReplies,
  };
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

function specialTarget(kind: SectionTargetKind, confidence: SectionTargetResult['confidence'], reason: string): SectionTargetResult {
  return {
    confidence,
    kind,
    reason,
    matches: [],
  };
}

function unresolvedTarget(
  snapshot: EnrichedSiteStructureSnapshot,
  extra?: Partial<SectionTargetResult>
): SectionTargetResult {
  return {
    confidence: 'low',
    kind: 'section',
    matches: snapshot.sections.map(toMatchCandidate),
    clarificationMessage:
      snapshot.sections.length > 0
        ? 'Which section should I change? Reply with the number:\n\n' +
          snapshot.sections
            .map((s, i) => `${i + 1}. [${s.index}] ${s.type} — "${s.title}"`)
            .join('\n')
        : 'Which part of the page should I change (hero, a section title, or site-wide background)?',
    suggestedReplies:
      snapshot.sections.length > 0
        ? snapshot.sections.map((s, i) => `${i + 1} — ${s.title}`)
        : ['Hero', 'Site-wide background'],
    ...extra,
  };
}

/**
 * Resolve WHERE the owner wants to edit (section index, hero, nav, footer).
 */
export function resolveSectionTarget(
  message: string,
  history: ConversationTurn[],
  snapshot: EnrichedSiteStructureSnapshot,
  catalog?: SiteSectionCatalog
): SectionTargetResult {
  const effectiveMessage = resolveEffectiveEditMessage(message, history);
  const recent = history.slice(-8);
  const sectionCatalog = catalog ?? buildSiteSectionCatalogFromSnapshot(snapshot);
  const numbered = resolveNumberedSectionReply(message, recent, snapshot);
  if (numbered) return numbered;

  const lower = effectiveMessage.toLowerCase();

  if (wantsNewImageSection(effectiveMessage)) {
    return {
      confidence: 'high',
      kind: 'section',
      reason: 'Owner requested a new section for uploaded images.',
      matches: [],
    };
  }

  const special = detectSpecialTarget(effectiveMessage);
  if (special && special !== 'section' && !/\bsection\b/.test(lower)) {
    return specialTarget(special, 'high', `Message targets ${special} (non-section).`);
  }

  const catalogMatch = matchSectionFromMessage(message, sectionCatalog, { history });
  if (catalogMatch) {
    if (catalogMatch.sectionIndex != null || catalogMatch.confidence === 'low') {
      return catalogMatch;
    }
  }

  if (/\b(top|first)\b/.test(lower) && !/\bsection\b/.test(lower)) {
    return {
      confidence: 'medium',
      kind: 'hero',
      reason: 'Ambiguous top/first — may mean hero or sections[0].',
      matches: [],
      clarificationMessage:
        'Do you mean the **hero** at the top of the page, or the **first content section** below it?',
      suggestedReplies: ['Hero at the top', 'First content section (sections[0])'],
    };
  }

  const titleCandidates = extractSectionTitleCandidates(effectiveMessage);
  const mentionsSection =
    /\bsection\b/.test(lower) ||
    ORDINAL_PATTERNS.some(({ pattern }) => pattern.test(effectiveMessage)) ||
    Boolean(extractQuotedTitle(effectiveMessage)) ||
    Boolean(extractColonSectionTitle(effectiveMessage)) ||
    titleCandidates.length > 0 ||
    Boolean(extractSectionTypeKeyword(effectiveMessage)) ||
    /\b(this|that)\s+section\b/i.test(effectiveMessage) ||
    (/\b(this|that)\b/i.test(effectiveMessage) && /\b(background|color|colour|card)\b/i.test(lower)) ||
    /\bbelow\b|\babove\b/.test(lower);

  if (!mentionsSection) {
    return {
      confidence: 'high',
      kind: 'section',
      reason: 'No section-specific anchor — site-wide or non-section edit.',
      matches: [],
    };
  }

  return unresolvedTarget(snapshot);
}

export type { SectionTargetResult, SectionMatchCandidate };
