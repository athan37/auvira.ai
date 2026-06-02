import { describe, expect, it } from 'vitest';
import type { WebsitePlan } from '@/lib/agent/schemas';
import { websitePlanToProposedPlan } from '@/lib/scratch/websitePlanToProposedPlan';

describe('websitePlanToProposedPlan', () => {
  it('maps content plan fields for ProposedPlanCard', () => {
    const plan: WebsitePlan = {
      businessName: 'Acme HVAC',
      industry: 'home-services',
      positioning: 'Trusted local HVAC experts',
      targetCustomers: ['Homeowners'],
      primaryGoal: 'Get more leads',
      recommendedPagesOrSections: [],
      contentPlan: {
        hero: {
          headline: 'Stay comfortable year-round',
          subheadline: 'Fast, reliable service',
          primaryCTA: 'Get a quote',
          secondaryCTA: 'View services',
        },
        sections: [
          { type: 'services', title: 'Our Services', purpose: 'Show core offerings' },
        ],
      },
      requiredMissingInfo: [],
      optionalMissingInfo: [],
      suggestedTemplate: {
        category: 'home-services',
        variant: 'local-service-pro',
        reason: 'Selected by owner',
        layoutStarterId: 'phone-first-service',
      },
      riskWarnings: [],
    };

    const proposed = websitePlanToProposedPlan(plan);
    expect(proposed.siteTitle).toBe('Acme HVAC');
    expect(proposed.tagline).toBe('Fast, reliable service');
    expect(proposed.primaryCTA).toBe('Get a quote');
    expect(proposed.sections).toHaveLength(1);
    expect(proposed.sections?.[0]?.title).toBe('Our Services');
  });
});
