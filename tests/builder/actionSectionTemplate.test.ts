import { describe, expect, it } from 'vitest';
import { PAGE_TSX_TEMPLATE } from '@/lib/builder/pageTemplate';
import { generateActionConfirmTsx } from '@/lib/builder/actionConfirmTemplate';
import { generateSiteConfig } from '@/lib/builder/templates';
import type { SiteSpec } from '@/lib/agent/schemas';

const baseSpec: SiteSpec = {
  siteTitle: 'Demo Co',
  tagline: 'We demo things',
  primaryCTA: 'Get Started',
  secondaryCTA: 'Learn More',
  designDirection: { tone: 'professional', layout: 'modern', colors: ['#0ea5e9'] },
  sections: [
    { type: 'hero', title: 'Welcome', body: 'Hero body', items: [] },
    { type: 'contact', title: 'Contact', body: 'Reach out', items: [] },
  ],
};

describe('actionSection template', () => {
  it('includes ActionSection renderer and actions case', () => {
    expect(PAGE_TSX_TEMPLATE).toContain('function ActionSection');
    expect(PAGE_TSX_TEMPLATE).toContain('case "actions"');
    expect(PAGE_TSX_TEMPLATE).toContain('ActionConfirmButton');
    expect(PAGE_TSX_TEMPLATE).toContain('action_value');
    expect(PAGE_TSX_TEMPLATE).toContain('action_title');
    expect(PAGE_TSX_TEMPLATE).toContain('action_item');
  });

  it('emits actions sections from category preset in siteConfig', () => {
    const source = generateSiteConfig(baseSpec, 'fundraising_event');
    expect(source).toContain('"type": "actions"');
    expect(source).toContain('"moduleKind": "donation_tiers"');
    expect(source).toContain('"actionType": "donate"');
    expect(source).toContain('categoryPreset: fundraising_event');
  });

  it('generates ActionConfirm client component template', () => {
    const source = generateActionConfirmTsx();
    expect(source).toContain("'use client'");
    expect(source).toContain('Thank you for supporting our cause!');
    expect(source).toContain('action_cta');
  });
});
