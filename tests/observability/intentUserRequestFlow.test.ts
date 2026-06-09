import { describe, expect, it } from 'vitest';
import {
  buildProjectVocabularyForChat,
  buildResolvedReferencesForChat,
  countEditContextPanelItems,
  enrichObservabilityMetadataForChat,
  formatResolvedReferencePanelLines,
  formatVocabularyPanelLines,
} from '@/lib/observability/formatEditContextSummary';
import { getMessageHintsView } from '@/lib/observability/formatCoachingSummary';
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
  it('favorite color request resolves from project vocabulary and surfaces in chat hints', async () => {
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
      resolvedReferences: resolution.references,
    });

    const hints = getMessageHintsView([], observability);
    expect(hints).not.toBeNull();
    expect(hints?.projectVocabulary?.some((line) => line.includes('Recurring topics'))).toBe(true);
    expect(hints?.projectVocabulary?.some((line) => line.includes('blue'))).toBe(true);
    expect(hints?.resolvedReferences?.[0]).toContain('my favorite color');
    expect(hints?.resolvedReferences?.[0]).toContain('blue');
    expect(hints?.resolvedReferences?.[0]).toContain('project vocabulary');
    expect(hints?.label).toMatch(/hint/);
  });

  it('usual CTA request resolves from project intent labels without chat history', async () => {
    const ownerMessage = 'change the hero button to our usual CTA';
    const projectIntent = sampleProjectIntent();

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
    });
    const hints = getMessageHintsView([], observability);
    expect(hints?.resolvedReferences?.[0]).toContain('our usual CTA');
    expect(hints?.resolvedReferences?.[0]).toContain('Book Now');
  });

  it('conflicting colors in project vocabulary ask clarification and omit resolved refs from chat', async () => {
    const ownerMessage = 'paint this my favorite color';
    const projectIntent = sampleProjectIntent({
      keywords: ['favorite color blue', 'favorite color green'],
    });

    const resolution = await resolveImplicitReferences({
      ownerMessage,
      editContext: intentFlowEditContext({ ownerMessage, effectiveMessage: ownerMessage }),
      projectIntent,
    });

    expect(resolution.needsClarification).toBe(true);
    expect(resolution.suggestedReplies).toEqual(expect.arrayContaining(['blue', 'green']));
    expect(hasResolvedReferenceValues(resolution.references)).toBe(false);

    const observability = chatObservabilityFromEditTurn({
      projectIntent,
      resolvedReferences: resolution.references,
    });
    const hints = getMessageHintsView([], observability);
    expect(hints?.resolvedReferences).toBeUndefined();
    expect(hints?.projectVocabulary).toBeDefined();
  });

  it('plain copy edit shows vocabulary only when turn_count > 0', async () => {
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
    });
    const hints = getMessageHintsView([], observability);
    expect(hints).not.toBeNull();
    expect(hints?.projectVocabulary?.length).toBeGreaterThan(0);
    expect(hints?.resolvedReferences).toBeUndefined();
  });

  it('first project turn hides vocabulary in chat even when keywords exist', async () => {
    const projectIntent = firstTurnProjectIntent();

    const observability = chatObservabilityFromEditTurn({ projectIntent });
    expect(buildProjectVocabularyForChat(projectIntent)).toBeUndefined();
    expect(observability?.projectVocabulary).toBeUndefined();

    const hints = getMessageHintsView([], observability);
    expect(hints).toBeNull();
  });

  it('coaching color hint resolves favorite color when intent is absent', async () => {
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

    const observability = chatObservabilityFromEditTurn({
      turnObservability: {
        coachingApplied: true,
        experimentVariant: 'coached',
        coachingHintCount: 1,
        coachingHints: coachingContext.coachingHints,
      },
      resolvedReferences: resolution.references,
    });
    const hints = getMessageHintsView([], observability);
    expect(hints?.resolvedReferences?.[0]).toContain('coaching context');
    expect(hints?.hints).toEqual(coachingContext.coachingHints);
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
    const vocabIdx = prompt.indexOf('## Project vocabulary');
    const resolvedIdx = prompt.indexOf('## Resolved user references');
    const coachingIdx = prompt.indexOf('## Coaching from prior edits');

    expect(vocabIdx).toBeGreaterThan(-1);
    expect(resolvedIdx).toBeGreaterThan(vocabIdx);
    expect(coachingIdx).toBeGreaterThan(resolvedIdx);
    expect(prompt).toContain('favorite color blue');
    expect(prompt).toContain('"my favorite color" → "blue"');
    expect(prompt).toContain('Prior color edit used blue');
  });

  it('planner blocks stay null when turn_count is zero or values are empty', () => {
    expect(formatProjectVocabularyBlock(firstTurnProjectIntent())).toBeNull();
    expect(
      formatProjectVocabularyBlock({
        keywords: [],
        intents: [],
        turn_count: 2,
        updated_at: null,
      })
    ).toBeNull();
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

describe('intent user-request flow — chat hints gating (when intent shows)', () => {
  it('returns null when observability metadata is empty', () => {
    expect(getMessageHintsView([], undefined)).toBeNull();
    expect(getMessageHintsView([], {})).toBeNull();
    expect(enrichObservabilityMetadataForChat(undefined, {})).toBeUndefined();
  });

  it('vocabulary-only chip appears without coaching or guidance hints', () => {
    const meta = enrichObservabilityMetadataForChat(undefined, {
      projectIntent: sampleProjectIntent(),
    });
    const hints = getMessageHintsView([], meta);
    expect(hints?.label).toMatch(/hint/);
    expect(hints?.hints).toEqual([]);
    expect(hints?.projectVocabulary?.length).toBeGreaterThan(0);
    expect(countEditContextPanelItems(meta)).toBeGreaterThan(0);
  });

  it('control arm shows vocabulary with coaching marked not applied', () => {
    const meta = enrichObservabilityMetadataForChat(
      {
        coachingApplied: false,
        experimentVariant: 'control',
        coachingHintCount: 2,
        coachingHints: ['Hint A', 'Hint B'],
      },
      { projectIntent: sampleProjectIntent() }
    );
    const hints = getMessageHintsView([], meta);
    expect(hints?.label).toContain('available (not applied)');
    expect(hints?.projectVocabulary?.length).toBeGreaterThan(0);
  });

  it('merges coaching, vocabulary, and resolved refs into one hint count', () => {
    const meta = enrichObservabilityMetadataForChat(
      {
        coachingApplied: true,
        experimentVariant: 'coached',
        coachingHintCount: 1,
        coachingHints: ['Honor pinned target.'],
      },
      {
        projectIntent: sampleProjectIntent(),
        resolvedReferences: [
          {
            phrase: 'my favorite color',
            resolvedValue: 'blue',
            resolvedKind: 'color',
            source: 'project_intent',
            confidence: 'high',
            reason: 'keyword',
          },
        ],
      }
    );
    const hints = getMessageHintsView(['Pin a section from the preview.'], meta);
    // 1 guidance + 1 coaching + 2 vocabulary lines + 1 resolved reference
    expect(hints?.label).toBe('5 hints');
    expect(hints?.hints).toEqual(['Pin a section from the preview.']);
    expect(hints?.monitorHints).toEqual(['Honor pinned target.']);
    expect(hints?.projectVocabulary?.length).toBeGreaterThan(0);
    expect(hints?.resolvedReferences?.length).toBe(1);
  });

  it('dedupes and caps vocabulary for display panels', () => {
    const vocab = buildProjectVocabularyForChat({
      keywords: ['Blue', 'blue', 'cta', ...Array.from({ length: 12 }, (_, i) => `topic${i}`)],
      intents: Array.from({ length: 8 }, (_, i) => ({ label: `edit type ${i}`, count: i + 1 })),
      turn_count: 6,
      updated_at: null,
    });
    expect(vocab?.keywords).toHaveLength(10);
    expect(vocab?.keywords.filter((k) => k.toLowerCase() === 'blue')).toHaveLength(1);
    expect(vocab?.intents).toHaveLength(5);

    const panelLines = formatVocabularyPanelLines(vocab);
    expect(panelLines[0]).toMatch(/^Recurring topics:/);
    expect(panelLines[1]).toMatch(/^Common edit types:/);

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
    expect(formatResolvedReferencePanelLines(resolvedRows)[0]).toContain('project vocabulary');
  });
});
