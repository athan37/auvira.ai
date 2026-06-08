import type { FactualSiteData, WebsitePlan } from './schemas';

export interface ClonePlanWarningsResult {
  warnings: string[];
  suggestions: string[];
}

const HALLUCINATION_PATTERNS = [
  /contact@example/i,
  /info@example/i,
  /\(?555\)\s*\d{3}[-\s]?\d{4}/i,
  /123\s+legal\s+plaza/i,
];

function planText(plan: WebsitePlan): string {
  const parts = [
    plan.businessName,
    plan.positioning,
    plan.contentPlan?.hero?.headline,
    plan.contentPlan?.hero?.subheadline,
    ...(plan.contentPlan?.sections?.flatMap((s) => [s.title, s.purpose, ...(s.contentNotes ?? [])]) ?? []),
  ];
  return parts.filter(Boolean).join(' ');
}

/** Non-blocking clone plan warnings — never gates Build Preview. */
export function validateClonePlanWarnings(
  plan: WebsitePlan,
  factualSiteData: FactualSiteData
): ClonePlanWarningsResult {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (!factualSiteData.businessName?.trim()) {
    warnings.push('Business name was not confidently extracted from the crawl.');
    suggestions.push('Confirm the business name before deploying.');
  }

  if (factualSiteData.phoneNumbers.length === 0 && factualSiteData.emails.length === 0) {
    warnings.push('No phone or email found in crawl — contact section may be incomplete.');
  }

  if (factualSiteData.practiceAreasOrServices.length === 0) {
    warnings.push('No services/practice areas extracted — plan may rely on inferred structure.');
  }

  if (factualSiteData.confidence?.overall !== undefined && factualSiteData.confidence.overall < 0.5) {
    warnings.push('Overall crawl confidence is low — verify facts in review.');
  }

  const hasTestimonialsSection = plan.contentPlan?.sections?.some(
    (s) => s.type === 'testimonials' || /testimonial|review/i.test(s.title)
  );
  const factualTestimonialCount = factualSiteData.testimonials?.length ?? 0;
  if (hasTestimonialsSection && factualTestimonialCount === 0) {
    warnings.push('Plan includes testimonials but none were found in crawl data.');
  }

  const text = planText(plan);
  for (const pattern of HALLUCINATION_PATTERNS) {
    if (pattern.test(text)) {
      warnings.push('Plan may contain placeholder contact info — review before deploy.');
      break;
    }
  }

  if (/A\+[\s-]?rated?/i.test(text) || /\d+[\s-]?years? (of )?(experience|success)/i.test(text)) {
    warnings.push('Plan may contain unverified marketing claims (awards, years of experience).');
  }

  if (plan.requiredMissingInfo?.length) {
    for (const item of plan.requiredMissingInfo) {
      suggestions.push(`Missing: ${item}`);
    }
  }

  if (plan.riskWarnings?.length) {
    warnings.push(...plan.riskWarnings);
  }

  return { warnings: [...new Set(warnings)], suggestions: [...new Set(suggestions)] };
}
