import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchObservabilityIntent, parseObservabilityProjectIntent } from '@/lib/observability/fetchObservabilityIntent';

vi.mock('@/lib/observability/client', () => ({
  fetchObservabilityIntentRaw: vi.fn(),
}));

import { fetchObservabilityIntentRaw } from '@/lib/observability/client';

describe('parseObservabilityProjectIntent', () => {
  it('parses single-sentence intent response', () => {
    const parsed = parseObservabilityProjectIntent({
      intent: 'Change the hero headline (hero.headline) to blue.',
    });
    expect(parsed?.sentence).toBe('Change the hero headline (hero.headline) to blue.');
  });

  it('returns null for non-string intent', () => {
    expect(parseObservabilityProjectIntent({ intent: { keywords: [] } })).toBeNull();
    expect(parseObservabilityProjectIntent({})).toBeNull();
  });
});

describe('fetchObservabilityIntent', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    vi.mocked(fetchObservabilityIntentRaw).mockReset();
  });

  afterEach(() => {
    process.env = env;
  });

  it('returns null when observability is disabled', async () => {
    process.env.OBSERVABILITY_ENABLED = '0';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    const result = await fetchObservabilityIntent({
      projectId: 'proj-1',
      userMessage: 'make hero blue',
    });
    expect(result).toBeNull();
    expect(fetchObservabilityIntentRaw).not.toHaveBeenCalled();
  });

  it('returns null when user message is empty', async () => {
    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    const result = await fetchObservabilityIntent({ projectId: 'proj-1', userMessage: '  ' });
    expect(result).toBeNull();
    expect(fetchObservabilityIntentRaw).not.toHaveBeenCalled();
  });

  it('POSTs user_message and selected_target to Monitor', async () => {
    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    vi.mocked(fetchObservabilityIntentRaw).mockResolvedValue({
      intent: 'Change sections[2].presentation.cardClass to green.',
    });

    const result = await fetchObservabilityIntent({
      projectId: 'proj-1',
      userMessage: 'change background to my favorite color',
      selectedTarget: {
        kind: 'section',
        sectionIndex: 2,
        sectionTitle: 'Contact Us',
      },
    });

    expect(result?.sentence).toContain('green');
    expect(fetchObservabilityIntentRaw).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        body: expect.objectContaining({
          user_message: 'change background to my favorite color',
          selected_target: expect.objectContaining({
            kind: 'section',
            section_index: 2,
          }),
          conversation_id: 'proj-1-editor',
        }),
      })
    );
  });

  it('falls back to hardcoded intent when Monitor returns null', async () => {
    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    process.env.OBSERVABILITY_INTENT_HARDCODE = '';
    vi.mocked(fetchObservabilityIntentRaw).mockResolvedValue(null);

    const result = await fetchObservabilityIntent({
      projectId: 'proj-1',
      userMessage: 'make section background blue',
      selectedTarget: {
        kind: 'section',
        sectionIndex: 0,
        fieldPath: 'sections[0].presentation.backgroundClass',
      },
    });

    expect(result?.sentence).toContain('gradient-blue');
    expect(result?.sentence).toContain('sections[0].presentation.backgroundClass');
  });

  it('returns null when Monitor fails and hardcode fallback is disabled', async () => {
    process.env.OBSERVABILITY_ENABLED = '1';
    process.env.OBSERVABILITY_API_KEY = 'test-key';
    process.env.OBSERVABILITY_INTENT_HARDCODE = '0';
    vi.mocked(fetchObservabilityIntentRaw).mockResolvedValue(null);

    const result = await fetchObservabilityIntent({
      projectId: 'proj-1',
      userMessage: 'make section background blue',
    });

    expect(result).toBeNull();
  });
});
