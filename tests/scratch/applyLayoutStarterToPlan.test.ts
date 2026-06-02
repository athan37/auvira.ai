import { describe, expect, it } from 'vitest';
import type { WebsitePlan } from '@/lib/agent/schemas';
import { applyLayoutStarterToPlan } from '@/lib/scratch/applyLayoutStarterToPlan';

const basePlan: WebsitePlan = {
  businessName: 'Test Co',
  industry: 'general',
  positioning: 'We help customers.',
  targetCustomers: ['Local buyers'],
  primaryGoal: 'Get more leads',
  recommendedPagesOrSections: [],
  contentPlan: {
    hero: {
      headline: 'Welcome',
      subheadline: 'Sub',
      primaryCTA: 'Contact',
      secondaryCTA: 'Learn',
    },
    sections: [],
  },
  requiredMissingInfo: [],
  optionalMissingInfo: [],
  suggestedTemplate: {
    category: 'general-service',
    variant: 'modern-clean',
    reason: 'LLM suggestion',
  },
  riskWarnings: [],
};

describe('applyLayoutStarterToPlan', () => {
  it('sets suggestedTemplate from layout starter id', () => {
    const plan = applyLayoutStarterToPlan(basePlan, 'phone-first-service');
    expect(plan.suggestedTemplate.layoutStarterId).toBe('phone-first-service');
    expect(plan.suggestedTemplate.variant).toBe('local-service-pro');
    expect(plan.suggestedTemplate.reason).toBe('Selected by owner');
  });

  it('uses default starter when id is missing', () => {
    const plan = applyLayoutStarterToPlan(basePlan);
    expect(plan.suggestedTemplate.layoutStarterId).toBe('centered-minimal');
  });
});
