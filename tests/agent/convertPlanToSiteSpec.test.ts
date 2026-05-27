import { describe, it, expect } from 'vitest';
import { convertPlanToSiteSpec } from '@/lib/agent/convertPlanToSiteSpec';
import type { WebsitePlan, ScratchIntake } from '@/lib/agent/schemas';

const basePlan: WebsitePlan = {
  businessName: 'Houston HVAC Pros',
  industry: 'HVAC',
  positioning: 'Trusted local HVAC experts.',
  targetCustomers: ['Homeowners'],
  primaryGoal: 'Get more leads',
  recommendedPagesOrSections: [],
  contentPlan: {
    hero: {
      headline: 'Premium HVAC Service in Houston',
      subheadline: 'Fast repairs and maintenance you can trust',
      primaryCTA: 'Schedule Service',
      secondaryCTA: 'View Services',
    },
    sections: [
      {
        type: 'services',
        title: 'Our Services',
        purpose: 'List core offerings',
        contentNotes: ['AC Repair', 'Maintenance'],
      },
    ],
  },
  requiredMissingInfo: [],
  optionalMissingInfo: [],
  suggestedTemplate: {
    category: 'home-services',
    variant: 'local-service-pro',
    reason: 'Local trades',
  },
  riskWarnings: [],
};

const baseIntake: ScratchIntake = {
  businessName: 'Houston HVAC Pros',
  industry: 'HVAC',
  location: 'Houston, TX',
  services: 'AC Repair, Maintenance',
  targetCustomers: 'Homeowners',
  mainGoal: 'Get more leads',
  phone: '713-555-0100',
  email: 'hello@houstonhvac.example',
  address: '',
  desiredStyle: 'home-services',
  notes: '',
};

describe('convertPlanToSiteSpec', () => {
  it('maps contentPlan.hero into siteSpec headline, tagline, and CTAs', () => {
    const spec = convertPlanToSiteSpec(basePlan, baseIntake);

    expect(spec.siteTitle).toBe('Premium HVAC Service in Houston');
    expect(spec.tagline).toBe('Fast repairs and maintenance you can trust');
    expect(spec.primaryCTA).toBe('Schedule Service');
    expect(spec.secondaryCTA).toBe('View Services');

    const hero = spec.sections.find((s) => s.type === 'hero');
    expect(hero?.title).toBe('Premium HVAC Service in Houston');
    expect(hero?.body).toBe('Fast repairs and maintenance you can trust');
  });

  it('includes contact items from intake when phone and email are provided', () => {
    const spec = convertPlanToSiteSpec(basePlan, baseIntake);
    const contact = spec.sections.find((s) => s.type === 'contact');

    expect(contact).toBeDefined();
    expect(contact?.items).toContain('713-555-0100');
    expect(contact?.items).toContain('hello@houstonhvac.example');
  });
});
