/**
 * Shared harness for observability accuracy A/B (control vs coached planner).
 */
import { expect } from 'vitest';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/types';
import type { WebsiteEditAgentResult } from '@/lib/project-workspace/edit-shared/types';
import type { ObservabilityCoachingContext } from '@/lib/observability/types';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
  type SyntheticSiteSpec,
} from '../support/syntheticSiteWorkspace';

/** Coaching mirrors Site Monitor output after wrong-section targeting. */
export const COACHING_WRONG_SECTION_INDEX: ObservabilityCoachingContext = {
  coachingHints: [
    'Prior turn updated the wrong section on a site with overlapping titles.',
    'Match owner paraphrase to catalog titles before choosing sectionIndex — testimonials often mention customers or growth.',
    'Do not default to index 0 when multiple sections share keywords like "grow" or "everything you need".',
  ],
  constraints: { require_correct_section_index: true },
  qualitySnapshot: { latest_grade: 'D', latest_overall_score: 0.45, trend: 'declining' },
  recurringIssues: ['WRONG_SECTION_TARGET', 'CATALOG_AMBIGUITY'],
  source: 'phoenix_traces',
};

/** Coaching after mis-reading a numbered catalog reply. */
export const COACHING_NUMBERED_REPLY: ObservabilityCoachingContext = {
  coachingHints: [
    'Prior turn ignored numbered catalog reply — when owner answers "3 — {title}" after clarification, use that exact sectionIndex.',
    'Do not re-open deictic ambiguity once the owner picked a catalog number.',
  ],
  constraints: { honor_numbered_catalog_reply: true },
  qualitySnapshot: { latest_grade: 'C', latest_overall_score: 0.58, trend: 'flat' },
  recurringIssues: ['CLARIFICATION_LOOP', 'DEICTIC_MISREAD'],
  source: 'phoenix_traces',
};

/** Coaching after applying a stale section target mid-thread. */
export const COACHING_RECENCY_OVERRIDE: ObservabilityCoachingContext = {
  coachingHints: [
    'Prior turn applied a stale section target from an earlier message.',
    'When owner says "Sorry, I meant {section} instead", the latest named section wins over prior turns.',
  ],
  constraints: { prefer_latest_section_mention: true },
  qualitySnapshot: { latest_grade: 'C', latest_overall_score: 0.55, trend: 'declining' },
  recurringIssues: ['STALE_SECTION_TARGET'],
  source: 'phoenix_traces',
};

/** Coaching after wrong catalog number then single-number correction. */
export const COACHING_WRONG_NUMBER_CORRECTION: ObservabilityCoachingContext = {
  coachingHints: [
    'Prior turn applied background to the wrong catalog number (contact instead of grow-business section).',
    'When owner sends a single correcting number like "1" after a wrong pick, apply the style edit to that catalog index only.',
  ],
  constraints: { honor_catalog_number_correction: true },
  qualitySnapshot: { latest_grade: 'D', latest_overall_score: 0.42, trend: 'declining' },
  recurringIssues: ['WRONG_CATALOG_NUMBER'],
  source: 'phoenix_traces',
};

/** Coaching after changing section bg when owner meant inner card panel. */
export const COACHING_CARD_NOT_SECTION: ObservabilityCoachingContext = {
  coachingHints: [
    'Prior turn changed section backgroundClass when owner meant the inner card panel.',
    'For "contact information background" on a pinned contact section, use presentationField cardClass — keep section backgroundClass unchanged.',
  ],
  constraints: { inner_card_not_section_wrapper: true },
  qualitySnapshot: { latest_grade: 'C', latest_overall_score: 0.6, trend: 'flat' },
  recurringIssues: ['CARD_VS_SECTION_CONFUSION'],
  source: 'phoenix_traces',
};

/** Coaching after hero clarification thread mis-routed to a content section. */
export const COACHING_HERO_NOT_SECTION: ObservabilityCoachingContext = {
  coachingHints: [
    'User clarified hero background across multiple turns — use update_theme with scope hero, not update_section_style.',
    'Do not route gradient or color follow-ups to About/services sections after hero was named in the thread.',
  ],
  constraints: { hero_not_content_section: true },
  qualitySnapshot: { latest_grade: 'D', latest_overall_score: 0.4, trend: 'declining' },
  recurringIssues: ['HERO_SECTION_CONFUSION'],
  source: 'phoenix_traces',
};

/** Coaching after build-gate failure on Tailwind class edits. */
export const COACHING_BUILD_GATE: ObservabilityCoachingContext = {
  coachingHints: [
    'Prior turn failed build gate — ensure TypeScript compiles before replying.',
    'Verify section background class exists in tailwind safelist before finishing.',
  ],
  constraints: { require_build_gate_pass: true, require_verify_pass: true },
  qualitySnapshot: { latest_grade: 'C', latest_overall_score: 0.62, trend: 'declining' },
  recurringIssues: ['EDIT_BUILD_GATE_FAILED'],
  source: 'phoenix_traces',
};

export function buildCatalogClarification(
  catalog: ReturnType<typeof buildSiteSectionCatalog>
): string {
  return (
    'Which section do you mean? Reply with the number:\n\n' +
    catalog.sections
      .map((section, index) => `${index + 1}. [${section.index}] ${section.type} — "${section.title}"`)
      .join('\n')
  );
}

export function accuracySignals(result: WebsiteEditAgentResult) {
  return {
    ok: result.ok === true,
    needsClarification: Boolean(result.needsClarification),
    changedFileCount: result.changedFiles?.length ?? 0,
    strategy: result.strategy ?? 'unknown',
    error: result.error ?? null,
  };
}

/** Higher = better edit outcome for accuracy comparison. */
export function accuracyScore(result: WebsiteEditAgentResult, targetValid = false): number {
  if (result.ok && !result.needsClarification && targetValid) return 100;
  if (result.ok && !result.needsClarification) return 85;
  if (result.needsClarification) return 45;
  return 0;
}

export type ObservabilityAbRunInput = {
  siteSpec?: SyntheticSiteSpec;
  createWorkspace?: () => Promise<string>;
  ownerMessage: string;
  conversationHistory?: ConversationTurn[];
  selectedTarget?: Parameters<typeof runWebsiteEditAgent>[0]['selectedTarget'];
  coaching: ObservabilityCoachingContext;
  sectionTargetLlm?: boolean;
  controlProjectId?: string;
  coachedProjectId?: string;
};

export type ObservabilityAbRunResult = {
  control: WebsiteEditAgentResult;
  coached: WebsiteEditAgentResult;
  controlWorkspacePath: string;
  coachedWorkspacePath: string;
};

/** Run the same edit on fresh workspaces — control (no coaching) vs coached. */
export async function runObservabilityAb(
  input: ObservabilityAbRunInput
): Promise<ObservabilityAbRunResult> {
  const prevSectionTargetLlm = process.env.SECTION_TARGET_LLM;
  if (input.sectionTargetLlm) {
    process.env.SECTION_TARGET_LLM = '1';
  }

  const controlWorkspacePath = input.createWorkspace
    ? await input.createWorkspace()
    : await createSyntheticWorkspace({
        site: input.siteSpec!,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

  const coachedWorkspacePath = input.createWorkspace
    ? await input.createWorkspace()
    : await createSyntheticWorkspace({
        site: input.siteSpec!,
        pageMode: 'wired',
        tailwind: 'canonical',
      });

  try {
    const agentBase = {
      ownerMessage: input.ownerMessage,
      conversationHistory: input.conversationHistory,
      mode: 'gitlab' as const,
      infraBaselineReady: true,
      selectedTarget: input.selectedTarget,
    };

    const control = await runWebsiteEditAgent({
      ...agentBase,
      workspacePath: controlWorkspacePath,
      projectId: input.controlProjectId ?? 'llm-obs-ab-control',
    });

    const coached = await runWebsiteEditAgent({
      ...agentBase,
      workspacePath: coachedWorkspacePath,
      projectId: input.coachedProjectId ?? 'llm-obs-ab-coached',
      coachingContext: input.coaching,
    });

    return { control, coached, controlWorkspacePath, coachedWorkspacePath };
  } finally {
    if (input.sectionTargetLlm) {
      if (prevSectionTargetLlm === undefined) {
        delete process.env.SECTION_TARGET_LLM;
      } else {
        process.env.SECTION_TARGET_LLM = prevSectionTargetLlm;
      }
    }
  }
}

export async function destroyAbWorkspaces(...paths: Array<string | undefined>): Promise<void> {
  for (const workspacePath of paths) {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
    }
  }
}

export function logObservabilityAbReport(input: {
  label: string;
  control: WebsiteEditAgentResult;
  coached: WebsiteEditAgentResult;
  controlScore: number;
  coachedScore: number;
}): void {
  // eslint-disable-next-line no-console -- accuracy A/B report for operator
  console.info('[observability accuracy A/B]', {
    scenario: input.label,
    control: accuracySignals(input.control),
    coached: accuracySignals(input.coached),
    controlScore: input.controlScore,
    coachedScore: input.coachedScore,
    delta: input.coachedScore - input.controlScore,
    coachedStrictlyBetter: input.coachedScore > input.controlScore,
    note: 'OBSERVABILITY_ENABLED=0 ≈ control. Coaching (COACHING_ENABLED=1) ≈ coached arm.',
  });
}

/** Coached arm should meet or beat control on accuracy score. */
export function assertCoachedMeetsOrBeatsControl(input: {
  label: string;
  control: WebsiteEditAgentResult;
  coached: WebsiteEditAgentResult;
  controlScore: number;
  coachedScore: number;
  /** When true, coached must strictly beat control (harder scenarios). */
  requireStrictImprovement?: boolean;
}): void {
  logObservabilityAbReport(input);

  if (input.requireStrictImprovement) {
    expect(
      input.coachedScore,
      `${input.label}: coached should strictly beat control`
    ).toBeGreaterThan(input.controlScore);
    return;
  }

  expect(
    input.coachedScore,
    `${input.label}: coached (${input.coachedScore}) should meet or beat control (${input.controlScore})`
  ).toBeGreaterThanOrEqual(input.controlScore);
}

export async function readSiteConfig(workspacePath: string): Promise<string> {
  return readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
}
