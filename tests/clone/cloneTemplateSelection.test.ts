import { describe, expect, it } from 'vitest';
import {
  buildCloneSuggestedTemplate,
  generateCloneWebsiteFiles,
  resolveCloneLayoutStarter,
  resolveCloneTemplateSelection,
} from '@/lib/clone/cloneTemplateSelection';
import { getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import type { SiteSpec } from '@/lib/agent/schemas';

const sampleSpec: SiteSpec = {
  siteTitle: 'Clone Test Co',
  tagline: 'Quality services',
  primaryCTA: 'Call now',
  secondaryCTA: 'Learn more',
  designDirection: { tone: 'professional', layout: 'modern', colors: [] },
  sections: [
    { type: 'hero', title: 'Welcome', body: 'Hero copy', items: [] },
    { type: 'contact', title: 'Contact', body: 'Reach us', items: [] },
  ],
};

describe('cloneTemplateSelection', () => {
  it('builds suggestedTemplate with independent layout and color', () => {
    const suggested = buildCloneSuggestedTemplate({
      templateCategory: 'restaurant',
      templateVariant: 'restaurant-warm',
      layoutStarterId: 'centered-minimal',
      themeOwnerSelected: true,
    });

    expect(suggested.layoutStarterId).toBe('centered-minimal');
    expect(suggested.variant).toBe('restaurant-warm');
    expect(suggested.category).toBe('restaurant');
  });

  it('generates files with decoupled layout and color', () => {
    const suggested = buildCloneSuggestedTemplate({
      templateCategory: 'restaurant',
      templateVariant: 'restaurant-warm',
      layoutStarterId: 'centered-minimal',
      themeOwnerSelected: true,
    });

    const generated = generateCloneWebsiteFiles(
      sampleSpec,
      'clone-decoupled',
      getDefaultDesignBrief('general-service'),
      suggested
    );

    const page = generated.files.find((f) => f.filePath === 'src/app/page.tsx')?.content ?? '';
    expect(resolveCloneLayoutStarter(suggested)?.heroStyle).toBe('centered');
    expect(resolveCloneTemplateSelection(suggested).variant).toBe('restaurant-warm');
    expect(page).toContain('"heroStyle":"centered"');
    expect(page).toContain('bg-[#FFFBEB]');
  });
});
