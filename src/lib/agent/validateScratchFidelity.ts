import type { WebsitePlan, ScratchIntake } from './schemas';
import type { ScratchValidationResult } from './schemas';

/**
 * Ensures the website plan stays aligned with owner-provided intake for structural content.
 * Phone and email are applied from intake at build time and are not required in the plan JSON.
 */
export function validateScratchFidelity(
  websitePlan: WebsitePlan,
  intake: ScratchIntake
): ScratchValidationResult {
  const issues: string[] = [];

  const hasTestimonialsSection = websitePlan.contentPlan?.sections?.some(
    (s) => s.type === 'testimonials' || /testimonial|review/i.test(s.title)
  );
  const intakeMentionsTestimonials =
    /testimonial|review|quote from/i.test(intake.notes || '') ||
    /testimonial|review/i.test(intake.services || '');

  if (hasTestimonialsSection && !intakeMentionsTestimonials) {
    issues.push('Plan includes testimonials but intake did not provide testimonial content.');
  }

  return { ok: issues.length === 0, issues };
}
