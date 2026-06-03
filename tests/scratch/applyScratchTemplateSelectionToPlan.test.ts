import { describe, expect, it } from 'vitest';
import type { WebsitePlan } from '@/lib/agent/schemas';
import { applyScratchTemplateSelectionToPlan } from '@/lib/scratch/applyScratchTemplateSelectionToPlan';

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

describe('applyScratchTemplateSelectionToPlan', () => {
  it('applies layout and color independently', () => {
    const plan = applyScratchTemplateSelectionToPlan(basePlan, {
      layoutStarterId: 'centered-minimal',
      templateCategory: 'restaurant',
      templateVariant: 'restaurant-warm',
    });

    expect(plan.suggestedTemplate.layoutStarterId).toBe('centered-minimal');
    expect(plan.suggestedTemplate.variant).toBe('restaurant-warm');
    expect(plan.suggestedTemplate.category).toBe('restaurant');
  });
});
