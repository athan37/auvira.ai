import { describe, expect, it } from 'vitest';
import { resolveCloneIntake } from '@/lib/clone/resolveCloneIntake';
import type { BusinessProfile, FactualSiteData } from '@/lib/agent/schemas';

const factual: FactualSiteData = {
  businessName: 'Acme HVAC',
  alternateNames: [],
  industry: 'HVAC',
  practiceAreasOrServices: ['AC Repair', 'Furnace Install'],
  people: [],
  locations: [{ label: 'Main', address: '123 Main St', sourceText: 'footer' }],
  phoneNumbers: ['(713) 555-0100'],
  emails: ['info@acmehvac.example'],
  serviceAreas: ['Houston', 'Katy'],
  testimonials: [{ quote: 'Great service!', sourceText: 'review page' }],
  ctas: ['Call now'],
  paymentLinks: [],
  socialLinks: [],
  sourceFacts: [],
  missingCriticalFields: [],
  confidence: { businessIdentity: 0.9, services: 0.8, contactInfo: 0.7, overall: 0.8 },
};

const profile: BusinessProfile = {
  businessName: 'Acme HVAC',
  industry: 'HVAC',
  description: 'Local HVAC company',
  services: ['AC Repair'],
  location: 'Houston, TX',
  phone: '',
  email: '',
  mainCTA: 'Get a quote',
  brandTone: 'professional',
  targetCustomers: ['Homeowners'],
  problemsWithCurrentSite: [],
  recommendedImprovements: [],
};

describe('resolveCloneIntake', () => {
  it('maps factual crawl data and business profile into scratch intake', () => {
    const intake = resolveCloneIntake(factual, profile);

    expect(intake.businessName).toBe('Acme HVAC');
    expect(intake.industry).toBe('HVAC');
    expect(intake.phone).toBe('(713) 555-0100');
    expect(intake.email).toBe('info@acmehvac.example');
    expect(intake.address).toBe('123 Main St');
    expect(intake.services).toContain('AC Repair');
    expect(intake.notes).toMatch(/testimonial/i);
  });

  it('falls back to business profile when factual contact is empty', () => {
    const sparseFactual = { ...factual, phoneNumbers: [], emails: [] };
    const richProfile = { ...profile, phone: '(713) 555-9999', email: 'hello@acme.com' };
    const intake = resolveCloneIntake(sparseFactual, richProfile);
    expect(intake.phone).toBe('(713) 555-9999');
    expect(intake.email).toBe('hello@acme.com');
  });
});
