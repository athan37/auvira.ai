import { describe, expect, it } from 'vitest';
import type { WebsitePlan } from '@/lib/agent/schemas';
import { OWNER_TEMPLATE_REASON } from '@/lib/builder/ownerTemplateSelection';
import { applyThemeToPlan } from '@/lib/scratch/applyThemeToPlan';

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
    layoutStarterId: 'centered-minimal',
  },
  riskWarnings: [],
};

describe('applyThemeToPlan', () => {
  it('sets color theme without changing layoutStarterId', () => {
    const plan = applyThemeToPlan(basePlan, 'restaurant', 'restaurant-warm');
    expect(plan.suggestedTemplate.variant).toBe('restaurant-warm');
    expect(plan.suggestedTemplate.category).toBe('restaurant');
    expect(plan.suggestedTemplate.layoutStarterId).toBe('centered-minimal');
    expect(plan.suggestedTemplate.reason).toBe(OWNER_TEMPLATE_REASON);
  });
});
