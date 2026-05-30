import { describe, expect, it } from 'vitest';
import {
  classifyFidelityIssue,
  hasCriticalFidelityFailures,
  validateContentFidelity,
} from '../../src/lib/agent/validateContentFidelity';
import type { FactualSiteData, SiteSpec } from '../../src/lib/agent/schemas';

const baseFactual: FactualSiteData = {
  businessName: 'Acme HVAC Services',
  alternateNames: [],
  industry: 'HVAC',
  phoneNumbers: ['512-555-0100'],
  emails: ['hello@acmehvac.com'],
  practiceAreasOrServices: ['AC repair', 'Furnace install'],
  serviceAreas: ['Austin, TX'],
  people: [],
  locations: [],
  testimonials: [],
  ctas: [],
  paymentLinks: [],
  socialLinks: [],
  sourceFacts: [],
  missingCriticalFields: [],
  confidence: {
    businessIdentity: 0.9,
    services: 0.9,
    contactInfo: 0.9,
    overall: 0.9,
  },
};

const baseSpec: SiteSpec = {
  siteTitle: 'Acme HVAC Services',
  tagline: 'Trusted heating and cooling',
  primaryCTA: 'Call now',
  secondaryCTA: 'Get a quote',
  sections: [
    {
      type: 'hero',
      title: 'Acme HVAC Services',
      body: 'Expert repair and installation.',
      items: ['Licensed', 'Insured'],
    },
    {
      type: 'services',
      title: 'Services',
      body: 'Full-service HVAC.',
      items: ['AC repair', 'Furnace install'],
    },
    {
      type: 'contact',
      title: 'Contact',
      body: 'Reach us anytime.',
      items: ['512-555-0100', 'hello@acmehvac.com'],
    },
  ],
  designDirection: { tone: 'professional', layout: 'modern', colors: ['#0ea5e9'] },
};

describe('validateContentFidelity severity', () => {
  it('passes when spec matches factual data', () => {
    const result = validateContentFidelity(baseSpec, baseFactual);
    expect(result.passed).toBe(true);
    expect(result.hasCriticalFailures).toBe(false);
    expect(result.criticalIssues).toHaveLength(0);
  });

  it('flags critical failure for wrong business title', () => {
    const result = validateContentFidelity(
      { ...baseSpec, siteTitle: 'Totally Different Company' },
      baseFactual
    );
    expect(result.hasCriticalFailures).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.criticalIssues.some((i) => i.startsWith('Site title'))).toBe(true);
  });

  it('treats unverified claims as warnings only', () => {
    const result = validateContentFidelity(
      {
        ...baseSpec,
        sections: [
          ...baseSpec.sections,
          {
            type: 'about',
            title: 'Experience',
            body: '25 years of experience serving the community.',
            items: [],
          },
        ],
      },
      baseFactual
    );
    expect(result.hasCriticalFailures).toBe(false);
    expect(result.passed).toBe(true);
    expect(result.warnIssues.length).toBeGreaterThan(0);
  });
});

describe('classifyFidelityIssue', () => {
  it('classifies phone mismatch as critical', () => {
    expect(
      classifyFidelityIssue('Generated site has phone numbers [(555) 123-4567] but none match extracted phones [512-555-0100]')
    ).toBe('critical');
  });

  it('classifies fake claim as warn', () => {
    expect(classifyFidelityIssue('Hallucination pattern detected: fakeClaim - Years not verified')).toBe('warn');
  });
});

describe('hasCriticalFidelityFailures', () => {
  it('returns true when criticalIssues present', () => {
    expect(hasCriticalFidelityFailures({ criticalIssues: ['bad'], hasCriticalFailures: false, issues: ['bad'] })).toBe(true);
  });

  it('classifies legacy issues without severity fields', () => {
    expect(
      hasCriticalFidelityFailures({
        issues: ['Site title "X" does not contain any words from business name "Y"'],
      })
    ).toBe(true);
  });
});
