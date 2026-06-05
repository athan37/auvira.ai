import { describe, expect, it } from 'vitest';
import { targetPreviewFallbackLabel } from '@/lib/preview/targetPreviewThumbnail';

describe('targetPreviewFallbackLabel', () => {
  it('returns item card text instead of generic container labels', () => {
    const label = targetPreviewFallbackLabel({
      elementLabel: 'Include minimum order requirements if any',
      targetChain: [
        { role: 'section', label: 'Delivery Coverage' },
        { role: 'item', label: 'Item 3', itemIndex: 2 },
        {
          role: 'element',
          kind: 'item_card',
          label: 'Include minimum order requirements if any',
          fieldPath: 'sections[4].items[2].title',
        },
      ],
    });
    expect(label).toBe('Include minimum order requirements if any');
  });

  it('skips generic Item cards label', () => {
    const label = targetPreviewFallbackLabel({
      targetChain: [{ role: 'container', kind: 'item_grid', label: 'Item cards' }],
    });
    expect(label).toBeUndefined();
  });

  it('falls back to section title for section-level pins', () => {
    const label = targetPreviewFallbackLabel({
      pinScope: 'section',
      sectionTitle: 'Get Started Today',
      targetChain: [{ role: 'section', label: 'Get Started Today' }],
    });
    expect(label).toBe('Get Started Today');
  });
});
