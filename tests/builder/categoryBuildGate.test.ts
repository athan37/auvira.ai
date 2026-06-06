import { describe, expect, it } from 'vitest';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { validateGeneratedSite } from '@/lib/builder/validateGeneratedSite';
import { getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import { getCategoryPreset, listCategoryPresets } from '@/lib/builder/categoryPresets';
import type { SiteSpec } from '@/lib/agent/schemas';

const runBuildGate = process.env.RUN_BUILD_GATE === '1';

function minimalSpec(title: string): SiteSpec {
  return {
    siteTitle: title,
    tagline: 'Tagline',
    primaryCTA: 'Get Started',
    secondaryCTA: 'Learn More',
    designDirection: { tone: 'professional', layout: 'modern', colors: ['#0ea5e9'] },
    sections: [
      { type: 'hero', title: 'Welcome', body: 'Hero', items: [] },
      { type: 'contact', title: 'Contact', body: 'Reach us', items: [] },
    ],
  };
}

describe('category preset generation', () => {
  for (const preset of listCategoryPresets()) {
    it(`${preset.id} generates actions sections and ActionConfirm`, () => {
      const generated = generateWebsiteFiles(
        minimalSpec(preset.label),
        `category-${preset.id}`,
        getDefaultDesignBrief('general-service'),
        undefined,
        undefined,
        preset.id
      );

      const siteConfig = generated.files.find((f) => f.filePath === 'src/lib/siteConfig.ts')?.content ?? '';
      expect(siteConfig).toContain('"type": "actions"');
      expect(siteConfig).toContain(`categoryPreset: ${preset.id}`);

      const hasConfirm = generated.files.some((f) => f.filePath === 'src/components/ActionConfirm.tsx');
      expect(hasConfirm).toBe(true);

      const page = generated.files.find((f) => f.filePath === 'src/app/page.tsx')?.content ?? '';
      expect(page).toContain('ActionSection');
    });
  }
});

describe.runIf(runBuildGate)('category build gate', () => {
  it('fundraising_event preset passes validateGeneratedSite build', async () => {
    const preset = getCategoryPreset('fundraising_event');
    const generated = generateWebsiteFiles(
      minimalSpec('Gala Fundraiser'),
      'category-build-gate-fundraising',
      getDefaultDesignBrief('general-service'),
      undefined,
      undefined,
      preset.id
    );

    const result = await validateGeneratedSite({
      files: generated.files,
      projectName: 'category-build-gate-fundraising',
    });
    expect(result.ok).toBe(true);
  });
});
