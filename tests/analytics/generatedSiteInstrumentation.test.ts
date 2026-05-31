import { describe, expect, it } from 'vitest';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import type { SiteSpec } from '@/lib/agent/schemas';
import {
  ensureAnalyticsIdsInSiteConfig,
  findSectionByAnalyticsId,
  stableAnalyticsIdForSection,
} from '@/lib/analytics/generated-sites/ensureAnalyticsIds';
import { injectAnalyticsIntoPageSource } from '@/lib/analytics/generated-sites/injectAnalyticsRuntime';
import {
  ANALYTICS_CONFIG_PATH,
  ANALYTICS_RUNTIME_PATH,
  PAGE_PATH,
  SITE_CONFIG_PATH,
} from '@/lib/analytics/generated-sites/analyticsConstants';
import { generateWebsiteAnalyticsSource } from '@/lib/analytics/generated-sites/analyticsSourceTemplates';
import { instrumentGeneratedFiles } from '@/lib/analytics/generated-sites/instrumentGeneratedSite';
import { generateSiteConfig } from '@/lib/builder/templates';

const siteSpec: SiteSpec = {
  siteTitle: 'Acme Services',
  tagline: 'Helpful local service',
  primaryCTA: 'Call Now',
  secondaryCTA: 'See Services',
  sections: [
    { type: 'hero', title: 'Acme Services', body: 'Reliable help', items: [] },
    { type: 'services', title: 'Our Services', body: 'What we do', items: ['Repair'] },
    { type: 'about', title: 'About Acme', body: 'Who we are', items: ['Trusted'] },
  ],
  designDirection: { tone: 'professional', layout: 'clean', colors: [] },
};

describe('generated-site analytics instrumentation', () => {
  it('adds missing analytics IDs deterministically', () => {
    const input = `export const siteConfig = {
  "sections": [
    { "type": "services", "title": "Our Services", "items": [] }
  ]
};`;
    const result = ensureAnalyticsIdsInSiteConfig(input);

    expect(result.changed).toBe(true);
    expect(result.content).toContain('"analyticsId": "section_services_our-services_1"');
    expect(result.sectionIds).toEqual([
      stableAnalyticsIdForSection({ type: 'services', title: 'Our Services' }, 0),
    ]);
  });

  it('preserves existing id and analyticsId', () => {
    const input = `export const siteConfig = {
  "sections": [
    { "id": "custom-section", "type": "services", "title": "Services", "items": [] },
    { "analyticsId": "analytics-existing", "type": "about", "title": "About", "items": [] }
  ]
};`;
    const result = ensureAnalyticsIdsInSiteConfig(input);

    expect(result.changed).toBe(false);
    expect(result.content).toContain('"id": "custom-section"');
    expect(result.content).toContain('"analyticsId": "analytics-existing"');
    expect(result.sectionIds).toEqual(['custom-section', 'analytics-existing']);
  });

  it('is idempotent', () => {
    const first = ensureAnalyticsIdsInSiteConfig(`export const siteConfig = {
  "sections": [{ "type": "faq", "title": "Questions", "items": [] }]
};`);
    const second = ensureAnalyticsIdsInSiteConfig(first.content);

    expect(second.changed).toBe(false);
    expect(second.content).toBe(first.content);
  });

  it('findSectionByAnalyticsId resolves by analyticsId and survives reorder', () => {
    const config = `export const siteConfig = {
  "sections": [
    { "analyticsId": "section_about_about_2", "type": "about", "title": "About", "items": [] },
    { "analyticsId": "section_services_services_1", "type": "services", "title": "Services", "items": [] }
  ]
};`;
    const about = findSectionByAnalyticsId(config, 'section_about_about_2');
    expect(about.found).toBe(true);
    expect(about.sectionIndex).toBe(0);

    const hero = findSectionByAnalyticsId(config, 'hero');
    expect(hero.found).toBe(true);
    expect(hero.sectionIndex).toBe(-1);
  });

  it('generated page includes data-site-section-* attrs', () => {
    const generated = generateWebsiteFiles(siteSpec, 'acme-services');
    const page = generated.files.find((file) => file.filePath === PAGE_PATH)?.content ?? '';
    expect(page).toContain('data-site-section-id="hero"');
    expect(page).toContain('data-site-section-index');
    expect(page).toContain('data-site-section-type');
    expect(page).toContain('data-site-section-title');
  });

  it('injectAnalyticsIntoPageSource adds site-section attrs idempotently', () => {
    const legacyPage = `<section id="services" className="px-4">Services</section>`;
    const once = injectAnalyticsIntoPageSource(legacyPage);
    expect(once).toContain('data-site-section-id');
    const twice = injectAnalyticsIntoPageSource(once);
    expect((twice.match(/data-site-section-id/g) ?? []).length).toBe(
      (once.match(/data-site-section-id/g) ?? []).length
    );
  });

  it('generated SiteSection type accepts optional IDs', () => {
    const source = generateSiteConfig(siteSpec);
    expect(source).toContain('id?: string');
    expect(source).toContain('analyticsId?: string');
  });

  it('generated files include analytics runtime, config, IDs, and passive attributes once', () => {
    const generated = generateWebsiteFiles(siteSpec, 'acme-services');
    const page = generated.files.find((file) => file.filePath === PAGE_PATH)?.content ?? '';
    const siteConfig = generated.files.find((file) => file.filePath === SITE_CONFIG_PATH)?.content ?? '';

    expect(generated.files.some((file) => file.filePath === ANALYTICS_CONFIG_PATH)).toBe(true);
    expect(generated.files.some((file) => file.filePath === ANALYTICS_RUNTIME_PATH)).toBe(true);
    expect(siteConfig).toContain('"analyticsId"');
    expect(page).toContain('data-analytics-id="hero"');
    expect(page).toContain('"data-analytics-type": "section"');
    expect(page).toContain('data-analytics-type="cta"');

    const reinstrumented = instrumentGeneratedFiles(generated.files, {
      publicSiteKey: generated.analytics?.publicSiteKey,
    });
    const reinstrumentedPage =
      reinstrumented.files.find((file) => file.filePath === PAGE_PATH)?.content ?? '';
    expect((reinstrumentedPage.match(/<WebsiteAnalytics\s*\/>/g) ?? []).length).toBe(1);
    expect(reinstrumented.files.filter((file) => file.filePath === ANALYTICS_RUNTIME_PATH)).toHaveLength(1);
  });

  it('runtime source is SSR-safe at import time', () => {
    const source = generateWebsiteAnalyticsSource();
    const beforeEffect = source.slice(0, source.indexOf('useEffect'));
    expect(source.startsWith('"use client";')).toBe(true);
    expect(beforeEffect).not.toContain('window.');
    expect(beforeEffect).not.toContain('document.');
    expect(source).toContain('return null');
  });

  it('runtime source avoids block-scoped function declarations (Next.js ES5 typecheck)', () => {
    const source = generateWebsiteAnalyticsSource();
    expect(source).not.toMatch(/\n\s+function flush\(/);
    expect(source).toContain('const flush = () =>');
  });
});
