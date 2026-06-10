import type { FactualSiteData } from './schemas';

const EMPTY_CONFIDENCE = {
  businessIdentity: 0,
  services: 0,
  contactInfo: 0,
  overall: 0,
};

/** Coerce partial LLM factual payloads into a safe FactualSiteData shape. */
export function normalizeFactualSiteData(raw: Partial<FactualSiteData> | null | undefined): FactualSiteData {
  return {
    businessName: raw?.businessName ?? '',
    alternateNames: raw?.alternateNames ?? [],
    industry: raw?.industry ?? '',
    practiceAreasOrServices: raw?.practiceAreasOrServices ?? [],
    people: raw?.people ?? [],
    locations: raw?.locations ?? [],
    phoneNumbers: raw?.phoneNumbers ?? [],
    emails: raw?.emails ?? [],
    serviceAreas: raw?.serviceAreas ?? [],
    testimonials: raw?.testimonials ?? [],
    ctas: raw?.ctas ?? [],
    paymentLinks: raw?.paymentLinks ?? [],
    socialLinks: raw?.socialLinks ?? [],
    sourceFacts: raw?.sourceFacts ?? [],
    missingCriticalFields: raw?.missingCriticalFields ?? [],
    confidence: raw?.confidence ?? EMPTY_CONFIDENCE,
  };
}
