import { describe, it, expect } from 'vitest';
import { validateScratchFidelity } from '@/lib/agent/validateScratchFidelity';
import type { WebsitePlan, ScratchIntake } from '@/lib/agent/schemas';

const intake: ScratchIntake = {
  businessName: 'Loop Co',
  industry: 'Consulting',
  location: 'Austin',
  services: 'Strategy',
  targetCustomers: 'SMBs',
  mainGoal: 'Leads',
  phone: '512-555-0100',
  email: 'owner@loopco.test',
  address: '',
  desiredStyle: 'professional',
  notes: '',
};

function planWithContact(phone: string, email: string): WebsitePlan {
  return {
    businessName: 'Loop Co',
    industry: 'Consulting',
    positioning: `Call us at ${phone} or email ${email}`,
    targetCustomers: ['SMBs'],
    primaryGoal: 'Leads',
    recommendedPagesOrSections: [],
    contentPlan: {
      hero: {
        headline: 'Loop Co',
        subheadline: 'Strategy for growth',
        primaryCTA: 'Contact',
        secondaryCTA: 'Learn more',
      },
    },
    requiredMissingInfo: [],
    optionalMissingInfo: [],
    suggestedTemplate: {
      category: 'general-service',
      variant: 'modern-clean',
      reason: 'Default',
    },
    riskWarnings: [],
  };
}

describe('validateScratchFidelity', () => {
  it('passes when plan omits phone and email (applied from intake at build)', () => {
    const result = validateScratchFidelity(
      planWithContact('', 'not-in-plan@example.com'),
      intake
    );
    expect(result.ok).toBe(true);
  });

  it('fails when plan adds testimonials not mentioned in intake', () => {
    const plan = planWithContact('', '');
    plan.contentPlan!.sections = [{ type: 'testimonials', title: 'Reviews', purpose: 'Social proof', contentNotes: ['Great'] }];
    const result = validateScratchFidelity(plan, intake);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => /testimonial/i.test(i))).toBe(true);
  });
});
