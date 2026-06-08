import { describe, expect, it } from 'vitest';
import { buildProposeWebsitePlanFromCrawlPrompt } from '@/lib/agent/prompts';
import type { BusinessProfile, FactualSiteData } from '@/lib/agent/schemas';

describe('buildProposeWebsitePlanFromCrawlPrompt', () => {
  it('includes extracted services and forbids invented contact in rules', () => {
    const factualSiteData: FactualSiteData = {
      businessName: 'River Plumbing',
      alternateNames: [],
      industry: 'Plumbing',
      practiceAreasOrServices: ['Drain cleaning', 'Water heaters'],
      people: [],
      locations: [],
      phoneNumbers: ['(555) 123-4567'],
      emails: [],
      serviceAreas: ['Austin'],
      testimonials: [],
      ctas: [],
      paymentLinks: [],
      socialLinks: [],
      sourceFacts: [],
      missingCriticalFields: ['email'],
      confidence: { businessIdentity: 0.8, services: 0.7, contactInfo: 0.5, overall: 0.7 },
    };

    const businessProfile: BusinessProfile = {
      businessName: 'River Plumbing',
      industry: 'Plumbing',
      description: 'Local plumber',
      services: ['Drain cleaning'],
      location: 'Austin, TX',
      phone: '(555) 123-4567',
      email: '',
      mainCTA: 'Call now',
      brandTone: 'friendly',
      targetCustomers: ['Homeowners'],
      problemsWithCurrentSite: [],
      recommendedImprovements: [],
    };

    const prompt = buildProposeWebsitePlanFromCrawlPrompt({ factualSiteData, businessProfile });

    expect(prompt).toContain('River Plumbing');
    expect(prompt).toContain('Drain cleaning');
    expect(prompt).toContain('Do not invent fake phone numbers');
    expect(prompt).toContain('"requiredMissingInfo"');
    expect(JSON.stringify(factualSiteData)).toBeTruthy();
  });
});
