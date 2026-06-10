import { describe, expect, it } from 'vitest';
import {
  buildProjectVocabularyForChat,
  buildResolvedReferencesForChat,
  countEditContextPanelItems,
  enrichObservabilityMetadataForChat,
  formatResolvedReferencePanelLines,
  formatUsedProjectContextLines,
  formatVocabularyPanelLines,
} from '@/lib/observability/formatEditContextSummary';
import {
  getAppliedCoachingView,
  getIntentFeedView,
  getProjectVocabularyView,
  getTipsView,
} from '@/lib/observability/formatCoachingSummary';
import {
  hasResolvedReferenceValues,
  resolveImplicitReferences,
} from '@/lib/project-workspace/edit-context/implicitReferenceResolver';
import {
  buildPlanEditSystemPrompt,
  formatProjectVocabularyBlock,
  formatResolvedReferencesBlock,
} from '@/lib/project-workspace/planner/planEditPrompt';
import {
  chatObservabilityFromEditTurn,
  firstTurnProjectIntent,
  intentFlowEditContext,
  sampleCoachingContext,
  sampleProjectIntent,
} from '../support/intentUserRequestFixtures';

describe('intent user-request flow — resolver to chat metadata', () => {
  it('favorite color request resolves and surfaces intent in chat metadata on success', async () => {
    const ownerMessage = 'make the contact section background my favorite color';
    const projectIntent = sampleProjectIntent();

    const resolution = await resolveImplicitReferences({
      ownerMessage,
      editContext: intentFlowEditContext({ ownerMessage, effectiveMessage: ownerMessage }),
      projectIntent,
    });

    expect(resolution.needsClarification).toBeUndefined();
    expect(resolution.references).toHaveLength(1);
    expect(resolution.references[0]).toMatchObject({
      phrase: 'my favorite color',
      resolvedValue: 'blue',
      source: 'project_intent',
    });
    expect(resolution.resolvedMessage).toContain('blue');
    expect(hasResolvedReferenceValues(resolution.references)).toBe(true);

    const observability = chatObservabilityFromEditTurn({
      turnObservability: {
        coachingApplied: true,
        experimentVariant: 'coached',
        coachingHintCount: 1,
        coachingHints: ['Keep palette consistent.'],
      },
      projectIntent,
      coachingContext: sampleCoachingContext(),
      resolvedReferences: resolution.references,
      outcome: 'success',
    });

    expect(getIntentFeedView(observability)?.panelLines[0]).toContain('blue');
    expect(observability?.appliedProjectMemory).toBeUndefined();
    expect(observability?.monitorContext).toBeUndefined();
    expect(getAppliedCoachingView('success', observability)?.hints).toEqual([
      'Keep palette consistent.',
    ]);
    expect(getTipsView('success', [], observability)).toBeNull();
  });

  it('usual CTA request resolves and intent sentence appears in chat metadata', async () => {
    const ownerMessage = 'change the hero button to our usual CTA';
    const projectIntent = sampleProjectIntent({
      sentence: 'Change the hero CTA (hero.primaryCta) to "Book Now".',
    });

    const resolution = await resolveImplicitReferences({
      ownerMessage,
      editContext: intentFlowEditContext({
        ownerMessage,
        effectiveMessage: ownerMessage,
        target: {
          kind: 'hero',
          confidence: 'high',
          candidates: [],
          needsClarification: false,
        },
      }),
      projectIntent,
    });

    expect(resolution.needsClarification).toBeUndefined();
    expect(resolution.references[0]).toMatchObject({
      phrase: 'our usual CTA',
      resolvedValue: 'Book Now',
      resolvedKind: 'cta',
      source: 'project_intent',
    });

    const observability = chatObservabilityFromEditTurn({
      projectIntent,
      resolvedReferences: resolution.references,
      outcome: 'success',
    });
    expect(getIntentFeedView(observability)?.panelLines[0]).toContain('Book Now');
  });

  it('conflicting colors ask clarification and still store intent when present', async () => {
    const ownerMessage = 'paint this my favorite color';
    const projectIntent = sampleProjectIntent({
      sentence:
        "Change the card background to the owner's favorite color; color not yet known from project history.",
    });

    const resolution = await resolveImplicitReferences({
      ownerMessage,
      editContext: intentFlowEditContext({ ownerMessage, effectiveMessage: ownerMessage }),
      projectIntent,
    });

    expect(resolution.needsClarification).toBe(true);
    expect(hasResolvedReferenceValues(resolution.references)).toBe(false);

    const observability = chatObservabilityFromEditTurn({
      projectIntent,
      resolvedReferences: resolution.references,
      outcome: 'clarification',
    });
    expect(observability?.appliedProjectMemory).toBeUndefined();
    expect(getProjectVocabularyView(observability)?.panelLines).toEqual(
      getIntentFeedView(observability)?.panelLines
    );
  });

  it('plain copy edit stores intent only when nothing resolved', async () => {
    const ownerMessage = "We'd love to hear from you";
    const projectIntent = sampleProjectIntent();

    const resolution = await resolveImplicitReferences({
      ownerMessage,
      editContext: intentFlowEditContext({ ownerMessage, effectiveMessage: ownerMessage }),
      projectIntent,
    });

    expect(resolution.references).toEqual([]);
    expect(resolution.resolvedMessage).toBeUndefined();

    const observability = chatObservabilityFromEditTurn({
      projectIntent,
      resolvedReferences: resolution.references,
      outcome: 'success',
    });
    expect(getIntentFeedView(observability)?.panelLines[0]).toContain('blue');
    expect(observability?.appliedProjectMemory).toBeUndefined();
    expect(getTipsView('success', [], observability)).toBeNull();
  });

  it('first project turn omits intent feed when sentence is absent', async () => {
    const projectIntent = firstTurnProjectIntent();

    const observability = chatObservabilityFromEditTurn({ projectIntent, outcome: 'success' });
    expect(buildProjectVocabularyForChat(projectIntent)).toBeUndefined();
    expect(observability?.appliedProjectMemory).toBeUndefined();

    expect(getIntentFeedView(observability)).toBeNull();
    expect(getTipsView('success', [], observability)).toBeNull();
  });

  it('coaching color hint resolves and shows tips on clarification', async () => {
    const ownerMessage = 'use my brand color on the card';
    const coachingContext = sampleCoachingContext({
      coachingHints: ['Owner prefers navy blue for brand accents.'],
    });

    const resolution = await resolveImplicitReferences({
      ownerMessage,
      editContext: intentFlowEditContext({ ownerMessage, effectiveMessage: ownerMessage }),
      coachingContext,
    });

    expect(resolution.needsClarification).toBeUndefined();
    expect(resolution.references[0]?.resolvedValue).toBe('blue');
    expect(resolution.references[0]?.source).toBe('coaching_context');

    const successObs = chatObservabilityFromEditTurn({
      turnObservability: {
        coachingApplied: true,
        experimentVariant: 'coached',
        coachingHintCount: 1,
        coachingHints: coachingContext.coachingHints,
      },
      resolvedReferences: resolution.references,
      outcome: 'success',
    });
    expect(successObs?.appliedProjectMemory).toBeUndefined();
    expect(getAppliedCoachingView('success', successObs)?.hints).toEqual(
      coachingContext.coachingHints
    );
    expect(getTipsView('success', [], successObs)).toBeNull();

    const clarifyObs = chatObservabilityFromEditTurn({
      turnObservability: {
        coachingApplied: true,
        experimentVariant: 'coached',
        coachingHintCount: 1,
        coachingHints: coachingContext.coachingHints,
      },
      outcome: 'clarification',
    });
    expect(getTipsView('clarification', [], clarifyObs)?.hints).toEqual(
      coachingContext.coachingHints
    );
  });
});

describe('intent user-request flow — planner prompt injection', () => {
  it('injects vocabulary and resolved references ahead of coaching for vague color request', async () => {
    const ownerMessage = 'make background my favorite color';
    const projectIntent = sampleProjectIntent();
    const coaching = sampleCoachingContext();

    const resolution = await resolveImplicitReferences({
      ownerMessage,
      editContext: intentFlowEditContext({ ownerMessage, effectiveMessage: ownerMessage }),
      projectIntent,
      coachingContext: coaching,
    });

    const prompt = buildPlanEditSystemPrompt(coaching, projectIntent, resolution.references);
    const intentIdx = prompt.indexOf('## Project intent');
    const resolvedIdx = prompt.indexOf('## Resolved user references');
    const coachingIdx = prompt.indexOf('## Coaching from prior edits');

    expect(intentIdx).toBeGreaterThan(-1);
    expect(resolvedIdx).toBeGreaterThan(intentIdx);
    expect(coachingIdx).toBeGreaterThan(resolvedIdx);
    expect(prompt).toContain('blue');
    expect(prompt).toContain('"my favorite color" → "blue"');
    expect(prompt).toContain('Prior color edit used blue');
  });

  it('planner blocks stay null when intent sentence or resolved values are empty', () => {
    expect(formatProjectVocabularyBlock(firstTurnProjectIntent())).toBeNull();
    expect(formatProjectVocabularyBlock({ sentence: '  ' })).toBeNull();
    expect(
      formatResolvedReferencesBlock([
        {
          phrase: 'usual CTA',
          resolvedKind: 'cta',
          source: 'project_intent',
          confidence: 'low',
          reason: 'missing value',
        },
      ])
    ).toBeNull();
  });
});

describe('intent user-request flow — chat metadata gating', () => {
  it('returns null when observability metadata is empty', () => {
    expect(getIntentFeedView(undefined)).toBeNull();
    expect(getTipsView('clarification', [], undefined)).toBeNull();
    expect(enrichObservabilityMetadataForChat(undefined, {})).toBeUndefined();
  });

  it('attaches intent feed only when project intent is present', () => {
    const meta = enrichObservabilityMetadataForChat(undefined, {
      outcome: 'success',
      projectIntent: sampleProjectIntent(),
      coachingContext: sampleCoachingContext(),
      resolvedReferences: [],
    });
    expect(meta?.intentFeed?.sentence).toContain('blue');
    expect(meta?.monitorContext).toBeUndefined();
    expect(getIntentFeedView(meta)?.label).toMatch(/^\/intent/);
  });

  it('control arm shows tips on clarification, not vocabulary', () => {
    const meta = enrichObservabilityMetadataForChat(
      {
        coachingApplied: false,
        experimentVariant: 'control',
        coachingHintCount: 2,
        coachingHints: ['Hint A', 'Hint B'],
      },
      { outcome: 'clarification' }
    );
    const tips = getTipsView('clarification', [], meta);
    expect(tips?.label).toContain('available (not applied)');
    expect(tips?.projectVocabulary).toBeUndefined();
  });

  it('clarification merges guidance and coaching into tips only', () => {
    const meta = enrichObservabilityMetadataForChat(
      {
        coachingApplied: true,
        experimentVariant: 'coached',
        coachingHintCount: 1,
        coachingHints: ['Honor pinned target.'],
      },
      { outcome: 'clarification' }
    );
    const tips = getTipsView('clarification', ['Pin a section from the preview.'], meta);
    expect(tips?.label).toBe('2 tips');
    expect(tips?.hints).toEqual(['Pin a section from the preview.']);
    expect(tips?.monitorHints).toEqual(['Honor pinned target.']);
  });

  it('formats intent sentence for chat panel helpers', () => {
    const vocab = buildProjectVocabularyForChat({
      sentence: 'Change sections[0].presentation.backgroundClass to blue.',
    });
    expect(vocab?.sentence).toContain('backgroundClass');

    const panelLines = formatVocabularyPanelLines(vocab);
    expect(panelLines[0]).toContain('backgroundClass');

    const resolvedRows = buildResolvedReferencesForChat([
      {
        phrase: 'my favorite color',
        resolvedValue: 'blue',
        resolvedKind: 'color',
        source: 'project_intent',
        confidence: 'high',
        reason: 'ok',
      },
      {
        phrase: 'usual CTA',
        resolvedKind: 'cta',
        source: 'chat_history',
        confidence: 'low',
        reason: 'unresolved',
      },
    ]);
    expect(resolvedRows).toHaveLength(1);
    expect(formatResolvedReferencePanelLines(resolvedRows)[0]).toContain('Project Memory');
    expect(
      countEditContextPanelItems({
        intentFeed: { sentence: 'Change sections[0].presentation.backgroundClass to blue.' },
      })
    ).toBe(1);
    expect(
      formatUsedProjectContextLines(resolvedRows)[0]
    ).toContain('Used project context');
  });
});
