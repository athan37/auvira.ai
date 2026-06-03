import { describe, expect, it } from 'vitest';
import { getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import type { SiteSpec } from '@/lib/agent/schemas';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { getLayoutStarter, getLayoutStarters } from '@/lib/builder/layoutStarters';
import { validateGeneratedFiles } from '@/lib/builder/validateGeneratedFiles';

const sampleSpec: SiteSpec = {
  siteTitle: 'Layout Starter Test Co',
  tagline: 'Quality services',
  primaryCTA: 'Call now',
  secondaryCTA: 'Learn more',
  designDirection: { tone: 'professional', layout: 'modern', colors: ['#0ea5e9'] },
  sections: [
    { type: 'hero', title: 'Welcome', body: 'Hero copy', items: [] },
    {
      type: 'services',
      title: 'Services',
      body: 'What we do',
      items: ['Repair', 'Install'],
    },
    {
      type: 'contact',
      title: 'Contact',
      body: 'Reach us',
      items: ['Phone: 512-555-0100'],
    },
  ],
};

describe('layout starter generation contract', () => {
  for (const starter of getLayoutStarters()) {
    it(`generates valid files for ${starter.id} (${starter.heroStyle})`, () => {
      const designBrief = {
        ...getDefaultDesignBrief(
          starter.category === 'legal' ||
          starter.category === 'healthcare' ||
          starter.category === 'home-services' ||
          starter.category === 'restaurant'
            ? starter.category
            : 'general-service'
        ),
        layoutStrategy: starter.layoutStrategy,
      };

      const generated = generateWebsiteFiles(
        sampleSpec,
        `layout-starter-${starter.id}`,
        designBrief,
        {
          category: starter.category,
          variant: starter.variant,
          reason: 'contract test',
        },
        starter
      );

      const page = generated.files.find((f) => f.filePath === 'src/app/page.tsx')?.content ?? '';
      expect(page).toContain(`"heroStyle":"${starter.heroStyle}"`);
      expect(validateGeneratedFiles(generated.files)).toEqual([]);

      if (starter.heroStyle === 'centered') {
        expect(page).toContain('function HeroCentered()');
      }
      if (starter.heroStyle === 'phone-first') {
        expect(page).toContain('function HeroPhoneFirst()');
      }
      if (starter.heroStyle === 'menu-feature') {
        expect(page).toContain('function HeroMenuFeature()');
      }
      if (starter.heroStyle === 'appointment-hero') {
        expect(page).toContain('function HeroAppointment()');
      }
      if (starter.heroStyle === 'split') {
        expect(page).toContain('function HeroSplit()');
      }
    });
  }

  it('uses color template variant independently from layout starter variant', () => {
    const starter = getLayoutStarter('centered-minimal')!;
    const designBrief = {
      ...getDefaultDesignBrief('general-service'),
      layoutStrategy: starter.layoutStrategy,
    };
    const specWithoutCustomBg: SiteSpec = {
      ...sampleSpec,
      designDirection: { tone: 'professional', layout: 'modern', colors: [] },
    };

    const generated = generateWebsiteFiles(
      specWithoutCustomBg,
      'decoupled-layout-color',
      designBrief,
      {
        category: 'restaurant',
        variant: 'restaurant-warm',
        reason: 'contract test',
      },
      starter
    );

    const page = generated.files.find((f) => f.filePath === 'src/app/page.tsx')?.content ?? '';
    expect(page).toContain('"heroStyle":"centered"');
    expect(page).toContain('bg-[#FFFBEB]');
    expect(validateGeneratedFiles(generated.files)).toEqual([]);
  });
});
