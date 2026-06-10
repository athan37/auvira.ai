import { describe, expect, it } from 'vitest';
import { mergeProjectMemory } from '@/lib/observability/localProjectMemory';
import type { ObservabilityProjectMemory } from '@/lib/observability/types';

describe('localProjectMemory merge', () => {
  it('returns local when remote is null', () => {
    const local: ObservabilityProjectMemory = {
      slots: [
        {
          id: '1',
          kind: 'color',
          phrase_aliases: ['my favorite color'],
          value: 'green',
          scope: { type: 'project' },
          provenance: { turn_id: 't1', user_message_excerpt: 'green' },
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      turn_count: 1,
      updated_at: null,
    };
    expect(mergeProjectMemory(null, local)?.slots).toHaveLength(1);
  });

  it('merges unique local slots into remote', () => {
    const remote: ObservabilityProjectMemory = {
      slots: [
        {
          id: '1',
          kind: 'color',
          phrase_aliases: ['brand color'],
          value: 'blue',
          scope: { type: 'project' },
          provenance: { turn_id: 't1', user_message_excerpt: 'blue' },
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      turn_count: 1,
      updated_at: null,
    };
    const local: ObservabilityProjectMemory = {
      slots: [
        {
          id: '2',
          kind: 'color',
          phrase_aliases: ['my favorite color'],
          value: 'green',
          scope: { type: 'project' },
          provenance: { turn_id: 't2', user_message_excerpt: 'green' },
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ],
      turn_count: 1,
      updated_at: null,
    };
    const merged = mergeProjectMemory(remote, local);
    expect(merged?.slots).toHaveLength(2);
  });
});
