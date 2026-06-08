import { describe, expect, it } from 'vitest';
import { websitePlanToReviewCard } from '@/lib/clone/planReviewAdapter';
import type { WebsitePlan } from '@/lib/agent/schemas';

describe('websitePlanToReviewCard', () => {
  it('maps WebsitePlan fields to review card shape', () => {
    const plan: WebsitePlan = {
      businessName: 'Loop Co',
      industry: 'Restaurant',
      positioning: 'Neighborhood favorite',
      targetCustomers: ['Locals'],
      primaryGoal: 'Drive reservations',
      recommendedPagesOrSections: [],
      contentPlan: {
        hero: {
          headline: 'Welcome to Loop Co',
          subheadline: 'Fresh food daily',
          primaryCTA: 'Reserve',
          secondaryCTA: 'Menu',
        },
        sections: [{ type: 'services', title: 'Our Menu', purpose: 'Show dishes' }],
      },
      requiredMissingInfo: ['Hours not found'],
      optionalMissingInfo: [],
      suggestedTemplate: { category: 'restaurant', variant: 'restaurant-warm', reason: 'Industry match' },
      riskWarnings: ['Thin crawl on menu page'],
    };

    const card = websitePlanToReviewCard(plan);
    expect(card.siteTitle).toBe('Loop Co');
    expect(card.tagline).toBe('Fresh food daily');
    expect(card.primaryCTA).toBe('Reserve');
    expect(card.positioningStatement).toBe('Neighborhood favorite');
    expect(card.sections).toHaveLength(1);
    expect(card.requiredMissingInfo).toContain('Hours not found');
    expect(card.riskWarnings).toContain('Thin crawl on menu page');
  });
});
