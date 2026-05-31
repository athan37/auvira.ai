import { describe, expect, it } from 'vitest';
import { generateSiteConfig } from '@/lib/builder/templates';
import type { SiteSpec } from '@/lib/agent/schemas';

describe('generateSiteConfig', () => {
  it('maps string testimonial items to title and description', () => {
    const spec: SiteSpec = {
      siteTitle: 'Test Co',
      tagline: 'We test things',
      primaryCTA: 'Call',
      designDirection: { tone: 'professional', layout: 'modern', colors: ['#0ea5e9'] },
  secondaryCTA: 'Email',
      sections: [
        { type: 'hero', title: 'Hero', body: 'Hero body', items: [] },
        {
          type: 'testimonials',
          title: 'Reviews',
          body: 'What clients say',
          items: ['Alice loved our service', 'Bob recommends us'],
        },
      ],
    };

    const source = generateSiteConfig(spec);
    expect(source).toContain('"title": "Alice loved our service"');
    expect(source).toContain('"description": "Alice loved our service"');
    expect(source).toContain('"title": "Bob recommends us"');
    expect(source).toContain('"description": "Bob recommends us"');
  });
});
