import type { WebsitePlan } from '@/lib/agent/schemas';

/** Map scratch WebsitePlan to ProposedPlanCard display shape. */
export function websitePlanToProposedPlan(plan: WebsitePlan) {
  return {
    siteTitle: plan.businessName,
    tagline: plan.contentPlan?.hero?.subheadline,
    primaryCTA: plan.contentPlan?.hero?.primaryCTA,
    secondaryCTA: plan.contentPlan?.hero?.secondaryCTA,
    positioningStatement: plan.positioning,
    sections:
      plan.contentPlan?.sections?.map((section) => ({
        type: section.type,
        title: section.title,
        purpose: section.purpose,
      })) ??
      plan.recommendedPagesOrSections?.map((section) => ({
        type: section.type,
        title: section.name,
        purpose: section.purpose,
      })) ??
      [],
  };
}
