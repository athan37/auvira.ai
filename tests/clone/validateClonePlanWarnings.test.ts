import { describe, expect, it } from 'vitest';
import { validateClonePlanWarnings } from '@/lib/agent/validateClonePlanWarnings';
import type { FactualSiteData, WebsitePlan } from '@/lib/agent/schemas';

const basePlan: WebsitePlan = {
  businessName: 'Acme Law',
  industry: 'Legal',
  positioning: 'Trusted counsel',
  targetCustomers: ['Families'],
  primaryGoal: 'Generate leads',
  recommendedPagesOrSections: [],
  contentPlan: {
    hero: { headline: 'Acme Law', subheadline: 'Help', primaryCTA: 'Call', secondaryCTA: 'Learn' },
    sections: [{ type: 'services', title: 'Services', purpose: 'List services' }],
  },
  requiredMissingInfo: [],
  optionalMissingInfo: [],
  suggestedTemplate: { category: 'legal', variant: 'premium-professional', reason: 'test' },
  riskWarnings: [],
};

const factual: FactualSiteData = {
  businessName: 'Acme Law',
  alternateNames: [],
  industry: 'Legal',
  practiceAreasOrServices: ['Family Law'],
  people: [],
  locations: [],
  phoneNumbers: ['(713) 555-0100'],
  emails: ['info@acmelaw.example'],
  serviceAreas: [],
  testimonials: [],
  ctas: [],
  paymentLinks: [],
  socialLinks: [],
  sourceFacts: [],
  missingCriticalFields: [],
  confidence: { businessIdentity: 0.9, services: 0.8, contactInfo: 0.8, overall: 0.85 },
};

describe('validateClonePlanWarnings', () => {
  it('returns warnings only and never blocks', () => {
    const result = validateClonePlanWarnings(basePlan, factual);
    expect(result.warnings).toBeInstanceOf(Array);
    expect(result.suggestions).toBeInstanceOf(Array);
    expect(result).not.toHaveProperty('passed');
  });

  it('warns when plan has testimonials but crawl has none', () => {
    const planWithTestimonials: WebsitePlan = {
      ...basePlan,
      contentPlan: {
        ...basePlan.contentPlan,
        sections: [
          ...(basePlan.contentPlan.sections ?? []),
          { type: 'testimonials', title: 'Client Reviews', purpose: 'Social proof' },
        ],
      },
    };
    const result = validateClonePlanWarnings(planWithTestimonials, factual);
    expect(result.warnings.some((w) => /testimonial/i.test(w))).toBe(true);
  });

  it('warns on thin crawl / missing contact', () => {
    const sparseFactual: FactualSiteData = {
      ...factual,
      phoneNumbers: [],
      emails: [],
      practiceAreasOrServices: [],
      confidence: { businessIdentity: 0.3, services: 0.2, contactInfo: 0.1, overall: 0.2 },
    };
    const result = validateClonePlanWarnings(basePlan, sparseFactual);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
