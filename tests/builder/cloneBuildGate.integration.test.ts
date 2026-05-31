import { describe, expect, it } from 'vitest';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { validateGeneratedSite } from '@/lib/builder/validateGeneratedSite';
import { getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import type { SiteSpec } from '@/lib/agent/schemas';

const runBuildGate = process.env.RUN_BUILD_GATE === '1';

const cloneLikeSpec: SiteSpec = {
  siteTitle: 'tests.com HVAC Prep',
  tagline: 'Practice exams and certification prep',
  primaryCTA: 'Start practice',
  secondaryCTA: 'Contact us',
  sections: [
    { type: 'hero', title: 'HVAC Practice Tests', body: 'Prepare for certification success', items: [] },
    { type: 'services', title: 'Our Products', body: 'Exam resources', items: ['HVAC Practice Exam', 'EPA 608 Prep'] },
    { type: 'about', title: 'About tests.com', body: 'Trusted prep provider', items: [] },
    {
      type: 'testimonials',
      title: 'What students say',
      body: 'Real results',
      items: ['Passed on the first try'],
    },
    { type: 'contact', title: 'Contact', body: 'Get in touch', items: ['Phone: (800) 394-5268'] },
  ],
  designDirection: { tone: 'warm', layout: 'modern', colors: ['#1E3A5F', '#2D8A4E'] },
};

describe.runIf(runBuildGate)('clone build gate integration', () => {
  it('generateWebsiteFiles passes validateGeneratedSite npm build', async () => {
    const generated = generateWebsiteFiles(
      cloneLikeSpec,
      'clone-build-gate-integration',
      getDefaultDesignBrief('restaurant'),
      { category: 'restaurant', variant: 'restaurant-warm', reason: 'integration test' }
    );

    const result = await validateGeneratedSite({
      files: generated.files,
      projectName: 'clone-build-gate-integration',
    });

    expect(result.ok, result.errors.join('; ') || result.logs).toBe(true);
    expect(result.files?.length).toBeGreaterThan(0);
  }, 300_000);
});
