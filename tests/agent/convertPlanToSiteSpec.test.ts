import { describe, expect, it } from 'vitest';
import { convertPlanToSiteSpec } from '@/lib/agent/convertPlanToSiteSpec';
import type { WebsitePlan, ScratchIntake } from '@/lib/agent/schemas';

const plan: WebsitePlan = {
  businessName: 'River City Plumbing',
  industry: 'Home services',
  positioning: 'Reliable plumbing.',
  targetCustomers: ['Homeowners'],
  primaryGoal: 'Leads',
  recommendedPagesOrSections: [],
  contentPlan: {
    hero: {
      headline: 'Trusted Plumbing',
      subheadline: 'Fast service',
      primaryCTA: 'Call',
      secondaryCTA: 'Learn',
    },
    sections: [
      {
        type: 'contact',
        title: 'Contact',
        purpose: 'Reach us',
        contentNotes: ['Call or email for a quote'],
      },
    ],
  },
  requiredMissingInfo: [],
  optionalMissingInfo: [],
  suggestedTemplate: { category: 'home-services', variant: 'local-service-pro', reason: 'test' },
  riskWarnings: [],
};

const intake: ScratchIntake = {
  businessName: 'River City Plumbing',
  industry: 'Home services',
  location: 'Austin',
  services: '',
  targetCustomers: '',
  mainGoal: 'Leads',
  phone: '512-555-9999',
  email: 'hello@rivercityplumbing.test',
  address: '',
  desiredStyle: 'home-services',
  notes: '',
};

describe('convertPlanToSiteSpec', () => {
  it('merges intake phone and email into an existing contact section', () => {
    const spec = convertPlanToSiteSpec(plan, intake);
    const contact = spec.sections.find((s) => s.type === 'contact');
    expect(contact?.items).toContain('512-555-9999');
    expect(contact?.items).toContain('hello@rivercityplumbing.test');
  });
});
