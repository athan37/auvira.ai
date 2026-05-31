import { describe, expect, it } from 'vitest';
import { mapMessageForApi } from '@/lib/chat/projectMessageMetadata';

describe('projectMessageMetadata', () => {
  it('mapMessageForApi exposes selectedTarget on user messages', () => {
    const mapped = mapMessageForApi({
      role: 'user',
      content: 'Make it blue',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      metadata: {
        selectedTarget: {
          kind: 'hero',
          sectionId: 'hero',
          sectionType: 'hero',
          sectionTitle: 'Hero',
        },
      },
    });

    expect(mapped.selectedTarget?.kind).toBe('hero');
    expect(mapped.selectedTarget?.sectionTitle).toBe('Hero');
  });
});
