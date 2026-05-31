import { scoreTitleMatch } from '@/lib/project-workspace/edit-shared/resolveSectionTarget';
import type { SiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import { resolveEditTarget } from '@/lib/project-workspace/edit-context/resolveEditTarget';
import type { SiteModel } from '@/lib/project-workspace/site-model/types';
import type { SyntheticSiteSpec } from './syntheticSiteWorkspace';
import {
  alternateTrapTitlesSiteSpec,
  confusingTitlesSiteSpec,
} from './hardCatalogSiteSpecs';

export interface SubstringTrapCase {
  word: string;
  forbiddenIndex: number;
  color: string;
}

export interface WordOverlapCase {
  /** Multi-word intent that uniquely token-matches one section title. */
  phrase: string;
  expectedIndex: number;
  color: string;
}

export interface ExactTitleCase {
  title: string;
  expectedIndex: number;
  color: string;
}

export interface TrapFixtureSuite {
  id: string;
  spec: SyntheticSiteSpec;
  substringTraps: SubstringTrapCase[];
  wordOverlapMatches: WordOverlapCase[];
  exactTitleMatches: ExactTitleCase[];
}

export const TRAP_FIXTURE_SUITES: TrapFixtureSuite[] = [
  {
    id: 'confusingTitles',
    spec: confusingTitlesSiteSpec(),
    substringTraps: [
      { word: 'business', forbiddenIndex: 0, color: 'yellow' },
      { word: 'growth', forbiddenIndex: 3, color: 'purple' },
      { word: 'started', forbiddenIndex: 4, color: 'blue' },
      { word: 'action', forbiddenIndex: 2, color: 'green' },
      { word: 'everything', forbiddenIndex: 0, color: 'red' },
      { word: 'know', forbiddenIndex: 1, color: 'orange' },
    ],
    wordOverlapMatches: [{ phrase: 'customers say', expectedIndex: 3, color: 'blue' }],
    exactTitleMatches: [
      {
        title: 'Everything You Need to Grow Your Business',
        expectedIndex: 0,
        color: 'navy',
      },
    ],
  },
  {
    id: 'alternateTrapTitles',
    spec: alternateTrapTitlesSiteSpec(),
    substringTraps: [
      { word: 'business', forbiddenIndex: 0, color: 'yellow' },
      { word: 'growth', forbiddenIndex: 1, color: 'purple' },
      { word: 'started', forbiddenIndex: 4, color: 'blue' },
      { word: 'showcase', forbiddenIndex: 2, color: 'green' },
      { word: 'trusted', forbiddenIndex: 0, color: 'red' },
      { word: 'portfolio', forbiddenIndex: 2, color: 'orange' },
    ],
    wordOverlapMatches: [{ phrase: 'happy customers', expectedIndex: 3, color: 'teal' }],
    exactTitleMatches: [
      {
        title: 'Portfolio Work We Love to Showcase',
        expectedIndex: 2,
        color: 'cyan',
      },
    ],
  },
];

export type ExplicitTitleBehavior = 'clarify' | 'match' | 'ambiguous';

/** Sections with score >= 50 for an explicit title intent. */
export function strongTitleMatches(
  intent: string,
  sections: Array<{ index: number; title: string }>
): Array<{ index: number; score: number; title: string }> {
  return sections
    .map((s) => ({
      index: s.index,
      title: s.title,
      score: scoreTitleMatch(s.title, intent),
    }))
    .filter((s) => s.score >= 50)
    .sort((a, b) => b.score - a.score);
}

/** Expected resolver behavior for "section titled {intent} to {color}". */
export function expectedExplicitTitleBehavior(
  intent: string,
  sections: Array<{ index: number; title: string }>
): ExplicitTitleBehavior {
  const strong = strongTitleMatches(intent, sections);
  if (strong.length === 0) return 'clarify';
  if (strong.length === 1) return 'match';
  return 'ambiguous';
}

export function sectionTitledStyleMessage(intent: string, color: string): string {
  return `change background of section titled ${intent} to ${color}`;
}

export function quotedTitleStyleMessage(title: string, color: string): string {
  return `change background of "${title}" to ${color}`;
}

/** Probe words embedded in titles but not equal to any full title (property-test inputs). */
export function probeWordsFromTitles(titles: string[]): string[] {
  const fullTitles = new Set(titles.map((t) => t.toLowerCase().trim()));
  const words = new Set<string>();
  for (const title of titles) {
    for (const raw of title.split(/\W+/)) {
      const w = raw.toLowerCase();
      if (w.length < 3 || w.length > 11) continue;
      if (fullTitles.has(w)) continue;
      words.add(w);
    }
  }
  return [...words].sort();
}

export function assertResolveEditTargetMatchesExpectation(
  message: string,
  catalog: SiteSectionCatalog,
  siteModel: SiteModel,
  intent: string
): void {
  const sections = catalog.sections.map((s) => ({ index: s.index, title: s.title }));
  const behavior = expectedExplicitTitleBehavior(intent, sections);
  const target = resolveEditTarget(message, siteModel, catalog);
  const strong = strongTitleMatches(intent, sections);

  if (behavior === 'clarify') {
    if (target.needsClarification !== true) {
      throw new Error(
        `Expected clarification for intent "${intent}", got sectionIndex=${target.sectionIndex}`
      );
    }
    return;
  }

  if (behavior === 'match') {
    if (target.needsClarification) {
      throw new Error(`Expected unique match for "${intent}", got clarification`);
    }
    if (target.sectionIndex !== strong[0]?.index) {
      throw new Error(
        `Expected section ${strong[0]?.index} for "${intent}", got ${target.sectionIndex}`
      );
    }
    return;
  }

  if (target.confidence === 'high' && target.sectionIndex != null) {
    const ok = strong.some((s) => s.index === target.sectionIndex);
    if (!ok) {
      throw new Error(
        `High-confidence pick index ${target.sectionIndex} not among strong matches for "${intent}"`
      );
    }
  }
}

/** Never high-confidence target a section when scoreTitleMatch is 0 for that intent. */
export function assertZeroScoreSectionsNeverHighConfidence(
  intent: string,
  catalog: SiteSectionCatalog,
  siteModel: SiteModel,
  message: string
): void {
  const target = resolveEditTarget(message, siteModel, catalog);
  if (target.confidence !== 'high' || target.sectionIndex == null) return;

  for (const section of catalog.sections) {
    if (section.index !== target.sectionIndex) continue;
    const score = scoreTitleMatch(section.title, intent);
    if (score === 0) {
      throw new Error(
        `High-confidence pick [${section.index}] "${section.title}" but scoreTitleMatch("${intent}")=0`
      );
    }
  }
}
