import { describe, it, expect } from 'vitest';
import { updateSectionBackgroundColorInSource } from '@/lib/project-workspace/siteConfigMutations';

const SITE_CONFIG = `export const siteConfig = {
  sections: [
    { type: "gallery", title: "Hello World" },
  ],
};`;

const PAGE = `function GallerySection({ section }) {
  return <section className={"py-20 " + resolveSectionBackground(section, preset)} />;
}`;

describe('section style config-first path', () => {
  it('updates siteConfig presentation without requiring page.tsx changes', () => {
    const updated = updateSectionBackgroundColorInSource(SITE_CONFIG, 0, 'yellow');
    expect(updated).toBeTruthy();
    expect(updated).toContain('bg-yellow-600');
    expect(updated).not.toContain('YELLOW_BG');
    expect(PAGE).not.toContain('bg-yellow');
  });
});
