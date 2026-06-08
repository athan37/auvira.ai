import type { WebsitePlan } from '@/lib/agent/schemas';

export interface ProposedPlanReviewCard {
  siteTitle?: string;
  tagline?: string;
  primaryCTA?: string;
  secondaryCTA?: string;
  positioningStatement?: string;
  sections?: Array<{ type: string; title?: string; purpose?: string; description?: string }>;
  requiredMissingInfo?: string[];
  riskWarnings?: string[];
}

/** Adapt WebsitePlan JSON to the clone review card shape. */
export function websitePlanToReviewCard(plan: WebsitePlan): ProposedPlanReviewCard {
  const hero = plan.contentPlan?.hero;
  const sections =
    plan.contentPlan?.sections?.map((sec) => ({
      type: sec.type,
      title: sec.title,
      purpose: sec.purpose,
    })) ??
    plan.recommendedPagesOrSections?.map((sec) => ({
      type: sec.type,
      title: sec.name,
      purpose: sec.purpose,
    })) ??
    [];

  return {
    siteTitle: plan.businessName,
    tagline: hero?.subheadline,
    primaryCTA: hero?.primaryCTA,
    secondaryCTA: hero?.secondaryCTA,
    positioningStatement: plan.positioning,
    sections,
    requiredMissingInfo: plan.requiredMissingInfo,
    riskWarnings: plan.riskWarnings,
  };
}
