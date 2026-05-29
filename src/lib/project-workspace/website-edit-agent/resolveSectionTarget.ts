import {
  analyzeSiteStructureForImages,
  buildStructureBriefForPlanner,
  type SiteStructureSnapshot,
  type SiteSectionSummary,
} from './siteStructureAnalysis';
import type { ConversationTurn } from './editAmbiguity';
import { wantsNewImageSection } from './imagePlacementIntent';
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

/** Fuzzy match between section title and user intent (shared with image pipeline). */
export function titleMatchesIntent(title: string, intent: string): boolean {
  const t = title.toLowerCase().trim();
  const i = intent.toLowerCase().trim();
  if (!t || !i) return false;
  return t === i || t.includes(i) || i.includes(t);
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
function formatStructureMapLines(sections: EnrichedSectionSummary[]): string {
  const lines: string[] = ['SITE STRUCTURE MAP:'];
  if (sections.length === 0) {
    lines.push('  (no siteConfig.sections — hero/nav/footer may be hardcoded)');
  } else {
    for (const s of sections) {
      lines.push(
        `  [${s.index}] type="${s.type}" title="${s.title}" → ${s.rendererComponent}`
      );
    }
  }
  return lines.join('\n');
}

/**
 * Build enriched site structure (section map + renderer + line ranges) for all edits.
 */
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
    };
  });

  const structureMap = formatStructureMapLines(sections);

  return {
    ...base,
    sections,
    structureMap,
  };
}

/** Human-readable section map for prompts and clarification. */
export function formatStructureMap(
  snapshot: Pick<EnrichedSiteStructureSnapshot, 'sections'>
): string {
  return formatStructureMapLines(snapshot.sections);
}

export function buildStructureBrief(snapshot: EnrichedSiteStructureSnapshot): string {
  return buildStructureBriefForPlanner(snapshot);
}

function extractQuotedTitle(message: string): string | null {
  const quoted = message.match(/["']([^"']{3,80})["']/);
  if (quoted?.[1]) return quoted[1].trim();
  if (/\bwhat our customers say\b/i.test(message)) return 'What Our Customers Say';
  return null;
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
  wasSectionListClarificationAsked,
} from '@/lib/chat/conversationContextForEdit';

export { wasSectionListClarificationAsked };
function resolveNumberedSectionReply(
  message: string,
  history: ConversationTurn[],
  snapshot: EnrichedSiteStructureSnapshot
): SectionTargetResult | null {
  if (!wasSectionListClarificationAsked(history)) return null;
  const match = message.trim().match(/^([1-9])\b/);
  if (!match) return null;
  const idx = parseInt(match[1], 10) - 1;
  const section = snapshot.sections[idx];
  if (!section) return null;
  return sectionTarget(section, 'high', `Owner picked section ${idx + 1} from clarification list.`);
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
  snapshot: EnrichedSiteStructureSnapshot
): SectionTargetResult {
  const recent = history.slice(-8);
  const numbered = resolveNumberedSectionReply(message, recent, snapshot);
  if (numbered) return numbered;

  const lower = message.toLowerCase();

  if (wantsNewImageSection(message)) {
    return {
      confidence: 'high',
      kind: 'section',
      reason: 'Owner requested a new section for uploaded images.',
      matches: [],
    };
  }

  const special = detectSpecialTarget(message);
  if (special && special !== 'section' && !/\bsection\b/.test(lower)) {
    return specialTarget(special, 'high', `Message targets ${special} (non-section).`);
  }

  for (const { pattern, index } of ORDINAL_PATTERNS) {
    if (pattern.test(message) && snapshot.sections.length > 0) {
      const idx = index(snapshot.sections.length);
      const section = snapshot.sections[idx];
      if (section) {
        return sectionTarget(section, 'high', `Ordinal match: ${pattern.source}`);
      }
    }
  }

  const quoted = /\bto\s*["'][^"']+["']/i.test(message) ? null : extractQuotedTitle(message);
  if (quoted) {
    return resolveTitleIntent(quoted, snapshot, `Title match: "${quoted}"`);
  }

  const colonTitle = extractColonSectionTitle(message);
  if (colonTitle) {
    return resolveTitleIntent(colonTitle, snapshot, `Colon title match: "${colonTitle}"`);
  }

  const typeKeyword = extractSectionTypeKeyword(message);
  if (typeKeyword) {
    const matches = snapshot.sections.filter((s) => s.type === typeKeyword);
    if (matches.length === 1) {
      return sectionTarget(matches[0]!, 'high', `Type keyword: ${typeKeyword}`);
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
  }

  if (
    (/\b(this|that)\b/i.test(message) &&
      /\b(background|color|colour|card|text)\b/i.test(lower) &&
      !colonTitle &&
      !quoted) ||
    /\b(this|that)\s+section\b/i.test(message) ||
    /\bbelow\b|\babove\b/.test(lower)
  ) {
    const candidates = snapshot.sections.map(toMatchCandidate);
    return {
      confidence: 'low',
      kind: 'section',
      matches: candidates,
      clarificationMessage:
        'Which section do you mean? Reply with the number:\n\n' +
        snapshot.sections
          .map((s, i) => `${i + 1}. [${s.index}] ${s.type} — "${s.title}"`)
          .join('\n'),
      suggestedReplies: snapshot.sections.map((s, i) => `${i + 1} — ${s.title}`),
    };
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

  const mentionsSection =
    /\bsection\b/.test(lower) ||
    ORDINAL_PATTERNS.some(({ pattern }) => pattern.test(message)) ||
    Boolean(extractQuotedTitle(message)) ||
    Boolean(extractColonSectionTitle(message)) ||
    Boolean(extractSectionTypeKeyword(message)) ||
    /\b(this|that)\s+section\b/i.test(message) ||
    (/\b(this|that)\b/i.test(message) && /\b(background|color|colour|card)\b/i.test(lower)) ||
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
