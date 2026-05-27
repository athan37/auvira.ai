import type { WebsitePlan, ScratchIntake } from './schemas';
import type { ScratchValidationResult } from './schemas';

/**
 * Ensures the website plan stays aligned with owner-provided intake (no invented contact facts).
 */
export function validateScratchFidelity(
  websitePlan: WebsitePlan,
  intake: ScratchIntake
): ScratchValidationResult {
  const issues: string[] = [];
  const planJson = JSON.stringify(websitePlan).toLowerCase();

  const userPhone = (intake.phone || '').replace(/\D/g, '');
  const userEmail = (intake.email || '').trim().toLowerCase();

  if (userPhone && userPhone.length >= 7) {
    const planDigits = planJson.replace(/\D/g, '');
    if (!planDigits.includes(userPhone) && !planJson.includes(intake.phone!.toLowerCase())) {
      issues.push('Plan does not include the phone number provided in intake.');
    }
  }

  if (userEmail && userEmail.includes('@')) {
    if (!planJson.includes(userEmail)) {
      issues.push('Plan does not include the email provided in intake.');
    }
  }

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
