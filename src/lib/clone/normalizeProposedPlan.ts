import type { SiteSpec, WebsitePlan } from '@/lib/agent/schemas';

/** True when stored plan is WebsitePlan (scratch shape), not legacy SiteSpec. */
export function isWebsitePlanShape(plan: unknown): plan is WebsitePlan {
  if (!plan || typeof plan !== 'object') return false;
  const p = plan as Record<string, unknown>;
  return Boolean(p.contentPlan && p.businessName);
}

/** One-off shim: convert legacy SiteSpec-shaped clone plan to WebsitePlan for in-flight jobs. */
export function siteSpecToWebsitePlan(siteSpec: SiteSpec, businessName: string, industry: string): WebsitePlan {
  const heroSection = siteSpec.sections.find((s) => s.type === 'hero');
  const otherSections = siteSpec.sections.filter((s) => s.type !== 'hero');

  return {
    businessName: businessName || siteSpec.siteTitle,
    industry: industry || 'general-service',
    positioning: siteSpec.tagline || heroSection?.body || '',
    targetCustomers: [],
    primaryGoal: siteSpec.primaryCTA || 'Generate leads',
    recommendedPagesOrSections: otherSections.map((sec, i) => ({
      name: sec.title,
      type: sec.type,
      priority: i + 1,
      purpose: sec.body,
    })),
    contentPlan: {
      hero: {
        headline: heroSection?.title || siteSpec.siteTitle,
        subheadline: heroSection?.body || siteSpec.tagline,
        primaryCTA: siteSpec.primaryCTA || 'Get Started',
        secondaryCTA: siteSpec.secondaryCTA || 'Learn More',
      },
      sections: otherSections.map((sec) => ({
        type: sec.type,
        title: sec.title,
        purpose: sec.body,
        contentNotes: sec.items,
      })),
    },
    requiredMissingInfo: [],
    optionalMissingInfo: [],
    suggestedTemplate: {
      category: 'general-service',
      variant: 'modern-clean',
      reason: 'Converted from legacy site spec',
    },
    riskWarnings: ['Plan converted from legacy site spec format'],
  };
}

/** Normalize stored proposed plan to WebsitePlan (handles in-flight SiteSpec jobs). */
export function normalizeProposedPlan(
  plan: unknown,
  businessName: string,
  industry: string
): WebsitePlan | null {
  if (!plan || typeof plan !== 'object') return null;
  if (isWebsitePlanShape(plan)) return plan;
  return siteSpecToWebsitePlan(plan as SiteSpec, businessName, industry);
}
