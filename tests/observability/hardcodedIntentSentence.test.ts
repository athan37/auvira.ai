import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildHardcodedIntentSentence,
  devDefaultFavoriteColor,
} from '@/lib/observability/hardcodedIntentSentence';
import { fetchObservabilityIntent } from '@/lib/observability/fetchObservabilityIntent';
import {
  buildPlanEditSystemPrompt,
  formatProjectIntentBlock,
} from '@/lib/project-workspace/planner/planEditPrompt';
import { resolveImplicitReferences } from '@/lib/project-workspace/edit-context/implicitReferenceResolver';
import { intentFlowEditContext } from '../support/intentUserRequestFixtures';

vi.mock('@/lib/observability/client', () => ({
  fetchObservabilityIntentRaw: vi.fn(),
}));

import { fetchObservabilityIntentRaw } from '@/lib/observability/client';

const contactPin = {
  kind: 'section' as const,
  sectionIndex: 2,
  sectionType: 'contact',
  sectionTitle: 'Contact Us',
  elementLabel: 'Contact Information',
  fieldPath: 'sections[2].presentation.cardClass',
  targetChain: [
    { role: 'section' as const, label: 'Contact Us' },
    { role: 'container' as const, label: 'Contact card' },
    { role: 'element' as const, label: 'Contact Information' },
  ],
};

describe('buildHardcodedIntentSentence', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.OBSERVABILITY_INTENT_DEV_FAVORITE_COLOR;
  });

  afterEach(() => {
    process.env = env;
  });

  it('favorite color + contact card pin produces detailed cardClass sentence with green default', () => {
    const { sentence } = buildHardcodedIntentSentence({
      userMessage: 'change background to my favorite color',
      selectedTarget: contactPin,
    });

    expect(sentence).toContain('sections[2].presentation.cardClass');
    expect(sentence).toContain('gradient-green');
    expect(sentence).toContain('favorite color is green');
    expect(sentence).toContain('Contact Information');
    expect(sentence).toContain('do not change other sections');
  });

  it('explicit blue on section background names backgroundClass path', () => {
    const { sentence } = buildHardcodedIntentSentence({
      userMessage: 'make the hero section background blue',
      selectedTarget: {
        kind: 'section',
        sectionIndex: 0,
        sectionTitle: 'Hero',
        fieldPath: 'sections[0].presentation.backgroundClass',
      },
    });

    expect(sentence).toContain('sections[0].presentation.backgroundClass');
    expect(sentence).toContain('gradient-blue');
  });

  it('copy edit with quoted text names exact field and value', () => {
    const { sentence } = buildHardcodedIntentSentence({
      userMessage: 'change headline to "Schedule Your Free Consultation"',
      selectedTarget: {
        kind: 'hero',
        fieldPath: 'hero.headline',
        elementLabel: 'Hero headline',
      },
    });

    expect(sentence).toContain('hero.headline');
    expect(sentence).toContain('Schedule Your Free Consultation');
    expect(sentence).toContain('exactly as stated');
  });

  it('unresolved favorite when dev default is disabled', () => {
    process.env.OBSERVABILITY_INTENT_DEV_FAVORITE_COLOR = 'none';
    const { sentence } = buildHardcodedIntentSentence({
      userMessage: 'make it my favorite color',
      selectedTarget: contactPin,
    });

    expect(sentence).toContain('color not yet known');
    expect(sentence).not.toContain('gradient-');
  });

  it('devDefaultFavoriteColor respects env override', () => {
    process.env.OBSERVABILITY_INTENT_DEV_FAVORITE_COLOR = 'blue';
    expect(devDefaultFavoriteColor()).toBe('blue');
  });
});

describe('hardcoded intent end-to-end scenarios', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env, OBSERVABILITY_ENABLED: '1', OBSERVABILITY_API_KEY: 'test-key' };
    delete process.env.OBSERVABILITY_INTENT_DEV_FAVORITE_COLOR;
    vi.mocked(fetchObservabilityIntentRaw).mockResolvedValue(null);
  });

  afterEach(() => {
    process.env = env;
    vi.mocked(fetchObservabilityIntentRaw).mockReset();
  });

  it('scenario 1: favorite color contact card — resolver + planner consume fallback intent', async () => {
    const ownerMessage = 'change background to my favorite color';
    const intent = await fetchObservabilityIntent({
      projectId: '6a26cc3deeea946b980a52da',
      userMessage: ownerMessage,
      selectedTarget: contactPin,
    });

    expect(intent?.sentence).toContain('sections[2].presentation.cardClass');
    expect(intent?.sentence).toContain('gradient-green');

    const resolution = await resolveImplicitReferences({
      ownerMessage,
      editContext: intentFlowEditContext({
        ownerMessage,
        effectiveMessage: ownerMessage,
        target: {
          kind: 'section',
          sectionIndex: 2,
          title: 'Contact Us',
          sectionType: 'contact',
          confidence: 'high',
          candidates: [],
          needsClarification: false,
        },
      }),
      projectIntent: intent,
    });

    expect(resolution.needsClarification).toBeUndefined();
    expect(resolution.references[0]?.resolvedValue).toBe('green');
    expect(resolution.references[0]?.source).toBe('project_intent');

    const plannerBlock = formatProjectIntentBlock(intent!);
    const prompt = buildPlanEditSystemPrompt(undefined, intent!);
    expect(plannerBlock).toContain('## Project intent');
    expect(prompt).toContain('sections[2].presentation.cardClass');
    expect(prompt).toContain('gradient-green');
  });

  it('scenario 2: explicit red section background produces detailed backgroundClass intent', async () => {
    const ownerMessage = 'set section background to red';
    const intent = await fetchObservabilityIntent({
      projectId: 'proj-2',
      userMessage: ownerMessage,
      selectedTarget: {
        kind: 'section',
        sectionIndex: 1,
        sectionTitle: 'Services',
        fieldPath: 'sections[1].presentation.backgroundClass',
      },
    });

    expect(intent?.sentence).toContain('gradient-red');
    expect(intent?.sentence).toContain('sections[1].presentation.backgroundClass');
    expect(intent?.sentence).toContain('set section background to red');

    const prompt = buildPlanEditSystemPrompt(undefined, intent!);
    expect(prompt).toContain('gradient-red');
  });

  it('scenario 3: quoted copy edit surfaces exact headline in planner', async () => {
    const ownerMessage = 'update the headline to "Book a Free Estimate"';
    const intent = await fetchObservabilityIntent({
      projectId: 'proj-3',
      userMessage: ownerMessage,
      selectedTarget: {
        kind: 'hero',
        fieldPath: 'hero.headline',
        elementLabel: 'Hero headline',
      },
    });

    expect(intent?.sentence).toContain('Book a Free Estimate');
    expect(intent?.sentence).toContain('hero.headline');

    const prompt = buildPlanEditSystemPrompt(undefined, intent!);
    expect(prompt).toContain('Book a Free Estimate');
  });

  it('forced hardcode skips Monitor POST', async () => {
    process.env.OBSERVABILITY_INTENT_HARDCODE = '1';
    const result = await fetchObservabilityIntent({
      projectId: 'proj-4',
      userMessage: 'make background blue',
      selectedTarget: { kind: 'section', sectionIndex: 0, fieldPath: 'sections[0].presentation.backgroundClass' },
    });

    expect(result?.sentence).toContain('gradient-blue');
    expect(fetchObservabilityIntentRaw).not.toHaveBeenCalled();
  });
});
