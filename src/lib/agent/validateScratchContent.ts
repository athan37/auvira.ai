import type { WebsitePlan, ScratchIntake, ScratchValidationResult } from './schemas';

const FAKE_EMAIL_PATTERNS = [
  /contact@example/i,
  /info@example/i,
  /hello@example/i,
  /admin@example/i,
  /support@example/i,
];

// Only block clearly fictional 555-01XX numbers (reserved for fictional use)
// Do NOT block real 555-XXXX exchanges like 512-555-9999 or 713-555-2190
const FAKE_PHONE_PATTERNS = [
  /\b(?:\+?1[-.\s]?)?\(?555\)?[-.\s]?01\d{2}\b/i,  // 555-0100 to 555-0199 only
  /\b555[-.\s]?01\d{2}\b/i,                          // standalone 555-01XX
  /123[-.\s]?\d{3}/i,                                // 123-XXX pattern
  /123-4567/,                                        // 123-4567 pattern
];

const FAKE_ADDRESS_PATTERNS = [
  /123\s+main\s+street/i,
  /123\s+business/i,
  /123\s+\d+\s+(st|ave|road|blvd)/i,
];

const UNSUPPORTED_CLAIM_PATTERNS = [
  /A\+[\s-]?rated?/i,
  /award-?winning/i,
  /#1\s*rated?/i,
  /thousands of (clients|customers|patients|cases)/i,
  /\d+[\s-]?years? (of )?(experience|success)/i,
  /\d+[\s-]?(year|yr)[\s-]?(experience|old)/i,
  /best in (town|city|industry|market)/i,
  /guaranteed/i,
  /certified expert/i,
];

export function validateScratchContent(
  websitePlan: WebsitePlan,
  intake: ScratchIntake
): ScratchValidationResult {
  const issues: string[] = [];

  // Collect user-provided contact info for exclusion
  const userPhone = (intake.phone || '').replace(/\D/g, '');
  const userEmail = (intake.email || '').toLowerCase();
  const userAddress = (intake.address || '').toLowerCase();

  const planJson = JSON.stringify(websitePlan).toLowerCase();
  const planPhoneNormalized = (websitePlan as { phone?: string }).phone?.replace(/\D/g, '') || '';

  // 1. Check for fake emails (skip if matches user-provided email)
  for (const pattern of FAKE_EMAIL_PATTERNS) {
    if (pattern.test(planJson) && !planJson.includes(userEmail)) {
      issues.push(`Fake email pattern detected: ${pattern.source}`);
    }
  }

  // 2. Check for fake phones (skip if matches user-provided phone)
  for (const pattern of FAKE_PHONE_PATTERNS) {
    if (pattern.test(planJson)) {
      // Allow if this matches user's provided phone
      if (userPhone && planPhoneNormalized.includes(userPhone)) {
        continue;
      }
      issues.push(`Fake phone pattern detected: ${pattern.source}`);
    }
  }

  // 3. Check for fake addresses (skip if matches user-provided address)
  for (const pattern of FAKE_ADDRESS_PATTERNS) {
    if (pattern.test(planJson)) {
      // Allow if this is part of user's provided address
      if (userAddress && planJson.includes(userAddress)) {
        continue;
      }
      issues.push(`Fake address pattern detected: ${pattern.source}`);
    }
  }

  // 4. Check for unsupported claims
  for (const pattern of UNSUPPORTED_CLAIM_PATTERNS) {
    if (pattern.test(planJson)) {
      issues.push(`Unsupported claim detected: ${pattern.source}`);
    }
  }

  // 5. Business name must match intake
  if (intake.businessName && websitePlan.businessName) {
    const intakeName = intake.businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const planName = websitePlan.businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!planName.includes(intakeName) && !intakeName.includes(planName)) {
      if (planName.length > 3 && intakeName.length > 3) {
        issues.push(`Business name in plan "${websitePlan.businessName}" does not closely match intake "${intake.businessName}"`);
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}