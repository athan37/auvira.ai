import { describe, expect, it } from 'vitest';
import {
  removeSectionFromSource,
  reorderSectionsInSource,
  updateSectionCopyInSource,
} from '@/lib/project-workspace/siteConfigMutations';

const SAMPLE = `export const siteConfig = {
  hero: { headline: 'Hi' },
  sections: [
    { type: 'gallery', title: 'Gallery', body: 'A' },
    { type: 'testimonials', title: 'Reviews', body: 'B' },
  ],
};`;

describe('siteConfigMutations section helpers', () => {
  it('updates section title', () => {
    const updated = updateSectionCopyInSource(SAMPLE, 0, 'title', 'Photos');
    expect(updated).toContain('Photos');
    expect(updated).not.toContain("title: 'Gallery'");
  });

  it('removes section by index', () => {
    const updated = removeSectionFromSource(SAMPLE, 0);
    expect(updated).toContain('Reviews');
    expect(updated).not.toContain('Gallery');
  });

  it('reorders sections', () => {
    const updated = reorderSectionsInSource(SAMPLE, [1, 0]);
    expect(updated?.indexOf('Reviews')).toBeLessThan(updated?.indexOf('Gallery') ?? 999);
  });
});
