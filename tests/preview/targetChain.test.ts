import { describe, expect, it } from 'vitest';
import {
  allowedFieldPathsForTarget,
  buildTargetChainFromFlat,
  enrichSelectedTarget,
  leafChainNode,
  resolvePinScope,
  resolveTargetChain,
  surfaceIdFromFieldPath,
} from '@/lib/preview/targetChain';
import { normalizeSelectedTarget } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import { formatPreviewTargetChain } from '@/lib/preview/previewTargetChipLabels';

describe('targetChain', () => {
  it('derives surface id from field path', () => {
    expect(surfaceIdFromFieldPath('sections[1].items[2].description')).toBe(
      'sections-1-items-2-description'
    );
  });

  it('builds flat chain with item position', () => {
    const chain = buildTargetChainFromFlat({
      kind: 'section',
      sectionIndex: 1,
      sectionType: 'services',
      sectionTitle: 'Our Services',
      fieldPath: 'sections[1].items[2].description',
      itemIndex: 2,
      elementKind: 'item_body',
      elementLabel: 'Service card description',
    });

    expect(chain.map((n) => n.label)).toEqual([
      'Services: Our Services',
      'Item 3',
      'Service card description',
    ]);
    expect(chain[1]?.itemPosition).toBe(3);
    expect(leafChainNode(chain)?.fieldPath).toBe('sections[1].items[2].description');
  });

  it('normalizes pin scope and chain from API payload', () => {
    const target = normalizeSelectedTarget({
      kind: 'section',
      sectionIndex: 4,
      sectionType: 'contact',
      sectionTitle: 'Get Started Today',
      fieldPath: 'contact.phone',
      surfaceId: 'contact-phone-button',
      pinScope: 'element',
      targetChain: [
        { role: 'section', label: 'Get Started Today', kind: 'contact' },
        { role: 'container', label: 'Contact card', kind: 'inner_card' },
        { role: 'element', label: 'Phone button', kind: 'button', fieldPath: 'contact.phone' },
      ],
    });

    expect(target?.pinScope).toBe('element');
    expect(resolvePinScope(target!)).toBe('element');
    expect(allowedFieldPathsForTarget(target!)).toEqual(['contact.phone']);
    expect(formatPreviewTargetChain(target!).map((r) => r.label)).toEqual([
      'Contact card',
      'Phone button',
    ]);
  });

  it('enriches missing chain from flat pin fields', () => {
    const enriched = enrichSelectedTarget({
      kind: 'section',
      sectionType: 'contact',
      sectionTitle: 'Get Started Today',
      sectionIndex: 4,
      fieldPath: 'sections[4].subtitle',
      elementKind: 'heading',
      elementLabel: 'Contact Information',
    });

    expect(enriched.pinScope).toBe('element');
    expect(resolveTargetChain(enriched).length).toBeGreaterThan(1);
  });
});
