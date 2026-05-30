import { describe, it, expect } from 'vitest';
import {
  migrateSubtitleStyleMarkersInSource,
  updateSectionBackgroundColorInSource,
  updateSectionPresentationInSource,
} from '@/lib/project-workspace/website-edit-agent-v2/siteConfigMutations';

const SAMPLE = `export type SiteSection = { type: string; title: string; presentation?: { backgroundClass?: string } };
export const siteConfig = {
  sections: [
    { type: "gallery", title: "Hello", body: "Photos" },
    { type: "about", title: "About" },
  ],
};`;

describe('siteConfigMutations presentation', () => {
  it('sets presentation.backgroundClass from color name', () => {
    const updated = updateSectionBackgroundColorInSource(SAMPLE, 0, 'yellow');
    expect(updated).toContain('presentation');
    expect(updated).toContain('bg-yellow-600');
    expect(updated).not.toContain('YELLOW_BG');
  });

  it('merges presentation fields on a section index', () => {
    const updated = updateSectionPresentationInSource(SAMPLE, 1, {
      cardClass: 'border-amber-300',
    });
    expect(updated).toContain('"cardClass": "border-amber-300"');
    expect(updated).toContain('"type": "about"');
  });

  it('migrates legacy subtitle color markers into presentation', () => {
    const withSubtitleMarker = `export const siteConfig = {
  sections: [
    { type: "gallery", title: "Hello", subtitle: "YELLOW_BG" },
  ],
};`;
    const updated = migrateSubtitleStyleMarkersInSource(withSubtitleMarker);
    expect(updated).toContain('"presentation"');
    expect(updated).toContain('"bg-yellow-600"');
    expect(updated).not.toContain('"YELLOW_BG"');
  });
});
