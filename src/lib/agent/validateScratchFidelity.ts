import type { WebsitePlan, ScratchIntake, FactualSiteData } from './schemas';
import type { ScratchValidationResult } from './schemas';

export interface ScratchFidelityOptions {
  /** When set (clone path), allow testimonials if crawl extracted them. */
  factualSiteData?: FactualSiteData;
}

/**
 * Ensures the website plan stays aligned with owner-provided intake for structural content.
 * Phone and email are applied from intake at build time and are not required in the plan JSON.
 */
export function validateScratchFidelity(
  websitePlan: WebsitePlan,
  intake: ScratchIntake,
  options?: ScratchFidelityOptions
): ScratchValidationResult {
  const issues: string[] = [];

  const hasTestimonialsSection = websitePlan.contentPlan?.sections?.some(
    (s) => s.type === 'testimonials' || /testimonial|review/i.test(s.title)
  );
  const crawlTestimonialCount = options?.factualSiteData?.testimonials?.length ?? 0;
  const intakeMentionsTestimonials =
    crawlTestimonialCount > 0 ||
    /testimonial|review|quote from/i.test(intake.notes || '') ||
    /testimonial|review/i.test(intake.services || '');

  if (hasTestimonialsSection && !intakeMentionsTestimonials) {
    issues.push('Plan includes testimonials but intake did not provide testimonial content.');
  }

  return { ok: issues.length === 0, issues };
}
