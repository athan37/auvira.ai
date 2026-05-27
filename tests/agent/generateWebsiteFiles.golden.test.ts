import { describe, it, expect } from 'vitest';
import { convertPlanToSiteSpec } from '@/lib/agent/convertPlanToSiteSpec';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import type { WebsitePlan, ScratchIntake } from '@/lib/agent/schemas';

const plan: WebsitePlan = {
  businessName: 'Sunrise Dental',
  industry: 'Dental',
  positioning: 'Family-friendly dental care.',
  targetCustomers: ['Families'],
  primaryGoal: 'Book appointments',
  recommendedPagesOrSections: [],
  contentPlan: {
    hero: {
      headline: 'Gentle Dental Care for Your Family',
      subheadline: 'Same-week appointments available',
      primaryCTA: 'Book Now',
      secondaryCTA: 'Our Services',
    },
    sections: [
      {
        type: 'services',
        title: 'Services',
        purpose: 'Core offerings',
        contentNotes: ['Cleanings', 'Whitening'],
      },
    ],
  },
  requiredMissingInfo: [],
  optionalMissingInfo: [],
  suggestedTemplate: {
    category: 'healthcare',
    variant: 'healthcare-calm',
    reason: 'Healthcare tone',
  },
  riskWarnings: [],
};

const intake: ScratchIntake = {
  businessName: 'Sunrise Dental',
  industry: 'Dental',
  location: 'Denver',
  services: 'Cleanings, Whitening',
  targetCustomers: 'Families',
  mainGoal: 'Book appointments',
  phone: '303-555-0100',
  email: 'hello@sunrise.test',
  address: '',
  desiredStyle: 'healthcare',
  notes: '',
};

describe('generateWebsiteFiles golden path', () => {
  it('embeds hero headline and contact in generated siteConfig', () => {
    const siteSpec = convertPlanToSiteSpec(plan, intake);
    const designBrief = getDefaultDesignBrief('healthcare');
    const { files } = generateWebsiteFiles(siteSpec, 'sunrise-dental-test', designBrief, {
      category: 'healthcare',
      variant: 'healthcare-calm',
      reason: 'test',
    });

    const siteConfig = files.find((f) => f.filePath === 'src/lib/siteConfig.ts')?.content ?? '';
    const page = files.find((f) => f.filePath === 'src/app/page.tsx')?.content ?? '';

    expect(siteConfig).toContain('Gentle Dental Care for Your Family');
    expect(siteConfig).toContain('303-555-0100');
    expect(page).toContain('healthcare-calm');
    expect(files.length).toBeGreaterThanOrEqual(8);
  });
});
