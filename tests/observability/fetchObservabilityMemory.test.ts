import { describe, expect, it } from 'vitest';
import {
  parseObservabilityProjectMemory,
} from '@/lib/observability/fetchObservabilityMemory';

describe('fetchObservabilityMemory parse', () => {
  it('parses memory slots with edit_pattern values', () => {
    const memory = parseObservabilityProjectMemory({
      turn_count: 2,
      updated_at: '2026-06-09T12:00:00Z',
      slots: [
        {
          id: 'slot-1',
          kind: 'color',
          phrase_aliases: ['my favorite color'],
          value: 'blue',
          scope: { type: 'project' },
          provenance: { turn_id: 'job-1' },
        },
        {
          id: 'slot-2',
          kind: 'edit_pattern',
          phrase_aliases: ['my favorite way to edit'],
          value: {
            what: 'style_card',
            params: { presentationField: 'cardClass', backgroundClass: 'gradient-blue' },
          },
          scope: { type: 'section_type', sectionType: 'contact' },
        },
      ],
    });

    expect(memory.slots).toHaveLength(2);
    expect(memory.slots[0]?.value).toBe('blue');
    expect(memory.slots[1]?.kind).toBe('edit_pattern');
    expect(memory.turn_count).toBe(2);
  });

  it('skips invalid slots', () => {
    const memory = parseObservabilityProjectMemory({
      slots: [{ kind: 'invalid', value: 'x', scope: { type: 'project' } }],
    });
    expect(memory.slots).toHaveLength(0);
  });
});
