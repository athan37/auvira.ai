import type { GeneratedFile } from './types';
import { validateGeneratedFileSet, type GeneratedValidationError } from './validateGeneratedOutput';

export interface ValidationError {
  file: string;
  error: string;
}

/**
 * Validates the actual GeneratedFile[] from generateWebsiteFiles before commit or build gate.
 */
export function validateGeneratedFiles(files: GeneratedFile[]): ValidationError[] {
  return validateGeneratedFileSet(files);
}

/**
 * Validates that the generated page content matches structural expectations
 * for the industry template (hero style, required sections, trust signals).
 */
export function templateDistinctivenessCheck(
  pageContent: string,
  industryTheme: string
): { ok: boolean; error?: string } {
  const checks: Record<string, () => { ok: boolean; error?: string }> = {
    legal: () => {
      const hasCredibilityBar = /years|experience|cases|free consultation/i.test(pageContent);
      const hasPracticeAreas = /practice areas?|specialt/i.test(pageContent);
      const hasAttorneySection = /attorney|lawyer|team|about our firm/i.test(pageContent);
      if (!hasCredibilityBar) {
        return { ok: false, error: 'Legal template missing credibility bar with experience/credentials' };
      }
      if (!hasPracticeAreas) {
        return { ok: false, error: 'Legal template missing practice areas section' };
      }
      if (!hasAttorneySection) {
        return { ok: false, error: 'Legal template missing firm/attorneys section' };
      }
      return { ok: true };
    },
    'home-services': () => {
      const hasPhoneNumber = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(pageContent);
      const hasEmergencyBanner = /24\/7|emergency|same.day/i.test(pageContent);
      const hasServiceArea = /service area|coverage|zip|serving/i.test(pageContent);
      if (!hasPhoneNumber) {
        return { ok: false, error: 'Home services template must have phone number prominently displayed' };
      }
      if (!hasEmergencyBanner) {
        return { ok: false, error: 'Home services template missing 24/7 emergency messaging' };
      }
      if (!hasServiceArea) {
        return { ok: false, error: 'Home services template missing service area section' };
      }
      return { ok: true };
    },
    restaurant: () => {
      const hasHours = /hours|open|closed|monday|tuesday|thursday|friday|saturday|sunday/i.test(pageContent);
      const hasMenu = /menu|dishes|appetizer|entree|dessert|food/i.test(pageContent);
      const hasReservationCta = /reserve|order|book/i.test(pageContent);
      if (!hasHours) return { ok: false, error: 'Restaurant template missing hours information' };
      if (!hasMenu) return { ok: false, error: 'Restaurant template missing menu or featured dishes section' };
      if (!hasReservationCta) {
        return { ok: false, error: 'Restaurant template missing reservation or order CTA' };
      }
      return { ok: true };
    },
    healthcare: () => {
      const hasAppointmentCta = /appointment|book|schedule|call today/i.test(pageContent);
      const hasInsurance = /insurance|accepted|payment|coverage/i.test(pageContent);
      const hasProviders = /doctor|physician|provider|nurse|medical team/i.test(pageContent);
      if (!hasAppointmentCta) {
        return { ok: false, error: 'Healthcare template must have prominent appointment CTA' };
      }
      if (!hasInsurance) {
        return { ok: false, error: 'Healthcare template missing insurance or payment info' };
      }
      if (!hasProviders) {
        return { ok: false, error: 'Healthcare template missing provider/staff section' };
      }
      return { ok: true };
    },
  };

  const check = checks[industryTheme];
  if (!check) return { ok: true };
  return check();
}

export type { GeneratedValidationError };
