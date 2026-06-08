import { describe, expect, it } from 'vitest';
import { isWebsitePlanShape, normalizeProposedPlan, siteSpecToWebsitePlan } from '@/lib/clone/normalizeProposedPlan';
import type { SiteSpec, WebsitePlan } from '@/lib/agent/schemas';

describe('normalizeProposedPlan', () => {
  it('detects WebsitePlan shape', () => {
    const plan: WebsitePlan = {
      businessName: 'Test',
      industry: 'General',
      positioning: 'Pos',
      targetCustomers: [],
      primaryGoal: 'Leads',
      recommendedPagesOrSections: [],
      contentPlan: {
        hero: { headline: 'H', subheadline: 'S', primaryCTA: 'A', secondaryCTA: 'B' },
      },
      requiredMissingInfo: [],
      optionalMissingInfo: [],
      suggestedTemplate: { category: 'general-service', variant: 'modern-clean', reason: 'default' },
      riskWarnings: [],
    };
    expect(isWebsitePlanShape(plan)).toBe(true);
  });

  it('converts legacy SiteSpec to WebsitePlan', () => {
    const siteSpec: SiteSpec = {
      siteTitle: 'Legacy Co',
      tagline: 'Old tagline',
      primaryCTA: 'Call',
      secondaryCTA: 'Email',
      sections: [
        { type: 'hero', title: 'Hero Title', body: 'Hero body', items: [] },
        { type: 'services', title: 'Services', body: 'We help', items: ['A', 'B'] },
      ],
      designDirection: { tone: 'pro', layout: 'clean', colors: [] },
    };

    const plan = siteSpecToWebsitePlan(siteSpec, 'Legacy Co', 'Services');
    expect(plan.businessName).toBe('Legacy Co');
    expect(plan.contentPlan.hero.headline).toBe('Hero Title');
    expect(plan.contentPlan.sections?.[0].type).toBe('services');
    expect(normalizeProposedPlan(siteSpec, 'Legacy Co', 'Services')?.businessName).toBe('Legacy Co');
  });
});
