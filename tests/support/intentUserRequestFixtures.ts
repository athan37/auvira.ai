import type {
  ProjectChatOutcome,
  ProjectMessageObservabilityMetadata,
} from '@/lib/chat/projectMessageMetadata';
import type { ObservabilityCoachingContext, ObservabilityProjectIntent } from '@/lib/observability/types';
import { enrichObservabilityMetadataForChat } from '@/lib/observability/formatEditContextSummary';
import type { ImplicitReferenceRecord } from '@/lib/project-workspace/edit-context/implicitReferenceTypes';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

/** Representative Monitor POST /intent sentence after context is established. */
export function sampleProjectIntent(
  overrides: Partial<ObservabilityProjectIntent> = {}
): ObservabilityProjectIntent {
  return {
    sentence:
      "Change the contact section background (sections[1].presentation.backgroundClass) to blue, the owner's favorite color.",
    ...overrides,
  };
}

/** No Monitor intent sentence available yet. */
export function firstTurnProjectIntent(): ObservabilityProjectIntent | null {
  return null;
}

export function sampleCoachingContext(
  overrides: Partial<ObservabilityCoachingContext> = {}
): ObservabilityCoachingContext {
  return {
    coachingHints: ['Prior color edit used blue — keep palette consistent.'],
    constraints: { require_build_gate_pass: true },
    qualitySnapshot: { latest_grade: 'B' },
    recurringIssues: ['EDIT_BUILD_GATE_FAILED'],
    source: 'phoenix_traces',
    ...overrides,
  };
}

/** Minimal edit context for implicit-reference + intent flow tests. */
export function intentFlowEditContext(overrides: Partial<EditContext> = {}): EditContext {
  return {
    workspacePath: '/tmp',
    mode: 'gitlab',
    ownerMessage: 'make background my favorite color',
    effectiveMessage: 'make background my favorite color',
    siteModel: {
      workspacePath: '/tmp',
      mode: 'gitlab',
      archetype: 'section-loop',
      siteConfigContent: `export const siteConfig = {
  "businessName": "Demo",
  "hero": { "headline": "Hero", "primaryCta": "Get Started" },
  "sections": [
    { "type": "hero", "title": "Hero", "presentation": { "backgroundClass": "gradient-blue" } },
    { "type": "contact", "title": "Contact", "subtitle": "Contact Information" }
  ]
} as const;`,
      parsedConfig: {
        businessName: 'Demo',
        hero: { headline: 'Hero', primaryCta: 'Get Started' },
        sections: [
          { type: 'hero', title: 'Hero', presentation: { backgroundClass: 'gradient-blue' } },
          { type: 'contact', title: 'Contact', subtitle: 'Contact Information' },
        ],
      },
    } as unknown as EditContext['siteModel'],
    sectionCatalog: { textBlock: '', sections: [] } as unknown as EditContext['sectionCatalog'],
    sections: [
      { index: 0, type: 'hero', title: 'Hero', presentation: { backgroundClass: 'gradient-blue' } },
      { index: 1, type: 'contact', title: 'Contact' },
    ],
    target: {
      kind: 'section',
      sectionIndex: 1,
      title: 'Contact',
      sectionType: 'contact',
      confidence: 'high',
      candidates: [],
      needsClarification: false,
    },
    selectedSnippets: [],
    allowedWritePaths: [],
    riskFlags: {
      level: 'low',
      compoundIntent: false,
      lowConfidenceTarget: false,
      infraNotReady: false,
      legacyArchetype: false,
      reasons: [],
    },
    verificationContract: { checks: [] },
    infraBaselineReady: true,
    ...overrides,
  };
}

/**
 * Mirror edit stream route: merge turn observability + applied memory into chat metadata.
 */
export function chatObservabilityFromEditTurn(input: {
  turnObservability?: ProjectMessageObservabilityMetadata | null;
  projectIntent?: ObservabilityProjectIntent | null;
  coachingContext?: ObservabilityCoachingContext | null;
  resolvedReferences?: ImplicitReferenceRecord[] | null;
  outcome?: ProjectChatOutcome;
}): ProjectMessageObservabilityMetadata | undefined {
  return enrichObservabilityMetadataForChat(input.turnObservability ?? undefined, {
    outcome: input.outcome,
    resolvedReferences: input.resolvedReferences,
    projectIntent: input.projectIntent,
    coachingContext: input.coachingContext,
  });
}
