import { describe, it, expect } from 'vitest';
import {
  buildSiteSectionCatalog,
  formatSectionCatalogForClarifier,
  formatSectionCatalogForPrompt,
  matchSectionFromMessage,
  stripColorWordsFromMessage,
} from '../../src/lib/project-workspace/website-edit-agent/siteSectionCatalog';

const siteConfig = `export const siteConfig = {
  sections: [
    { type: "services", title: "Everything You Need to Grow Your Business", items: [] },
    { type: "testimonials", title: "What Our Customers Say", items: [] },
    { type: "contact", title: "Get Started Today", items: [] },
  ],
};`;

const page = `
function ServicesSection({ section }) {
  return <section className={"py-20 " + preset.surfaceBg}>{section.title}</section>;
}
function TestimonialsSection({ section }) {
  return <section className={"py-20 " + preset.surfaceBg}>{section.title}</section>;
}
function ContactSection({ section }) {
  return <section className={"py-20 " + preset.mutedBg}>{section.title}</section>;
}
function SectionRenderer({ section }) {
  switch (section.type) {
    case "services": return <ServicesSection section={section} />;
    case "testimonials": return <TestimonialsSection section={section} />;
    case "contact": return <ContactSection section={section} />;
    default: return null;
  }
}
{siteConfig.sections.map((s) => <SectionRenderer section={s} />)}
`;

describe('siteSectionCatalog', () => {
  const catalog = buildSiteSectionCatalog(siteConfig, page);

  it('lists all sections from siteConfig', () => {
    expect(catalog.sections).toHaveLength(3);
    expect(catalog.textBlock).toContain('SITE STRUCTURE MAP');
    expect(catalog.textBlock).toContain('Everything You Need to Grow Your Business');
    expect(catalog.textBlock).toContain('Get Started Today');
    expect(catalog.numberedReplies).toEqual([
      '1 — Everything You Need to Grow Your Business',
      '2 — What Our Customers Say',
      '3 — Get Started Today',
    ]);
  });

  it('formatSectionCatalogForClarifier includes indices and titles', () => {
    const block = formatSectionCatalogForClarifier(catalog);
    expect(block).toContain('AVAILABLE HOMEPAGE SECTIONS');
    expect(block).toContain('[0] services — "Everything You Need to Grow Your Business"');
    expect(block).toContain('[2] contact — "Get Started Today"');
  });

  it('formatSectionCatalogForPrompt matches textBlock', () => {
    expect(formatSectionCatalogForPrompt(catalog)).toBe(catalog.textBlock);
  });

  it('resolves deictic + quoted title + color to the named section', () => {
    const result = matchSectionFromMessage(
      'change this section background to blue "Everything You Need to Grow Your Business"',
      catalog
    );
    expect(result?.confidence).toBe('high');
    expect(result?.sectionIndex).toBe(0);
    expect(result?.title).toMatch(/grow your business/i);
  });

  it('does not match contact when services title is quoted', () => {
    const result = matchSectionFromMessage(
      'change this section background to blue "Everything You Need to Grow Your Business"',
      catalog
    );
    expect(result?.sectionIndex).not.toBe(2);
  });

  it('returns clarification with numbered list for deictic color without title', () => {
    const result = matchSectionFromMessage('change this section background to blue', catalog);
    expect(result?.confidence).toBe('low');
    expect(result?.clarificationMessage).toMatch(/which section/i);
    expect(result?.clarificationMessage).toContain('Get Started Today');
    expect(result?.suggestedReplies).toEqual(catalog.numberedReplies);
  });

  it('stripColorWordsFromMessage removes color tokens for fuzzy match', () => {
    const stripped = stripColorWordsFromMessage(
      'change this section background to blue "Everything You Need to Grow Your Business"'
    );
    expect(stripped.toLowerCase()).not.toContain('blue');
    expect(stripped).toMatch(/grow your business/i);
  });

  it('resolves first section ordinal', () => {
    const result = matchSectionFromMessage('change background of first section to yellow', catalog);
    expect(result?.sectionIndex).toBe(0);
    expect(result?.confidence).toBe('high');
  });

  it('resolves unquoted title suffix after color word', () => {
    const result = matchSectionFromMessage(
      'change this section background to blue Everything You Need to Grow Your Business',
      catalog
    );
    expect(result?.confidence).toBe('high');
    expect(result?.sectionIndex).toBe(0);
  });

  it('resolves unquoted title suffix after color gradient filler', () => {
    const result = matchSectionFromMessage(
      'change this section background to color gradient Everything You Need to Grow Your Business',
      catalog
    );
    expect(result?.confidence).toBe('high');
    expect(result?.sectionIndex).toBe(0);
    expect(result?.sectionIndex).not.toBe(2);
  });

  it('stripColorWordsFromMessage removes gradient filler tokens', () => {
    const stripped = stripColorWordsFromMessage(
      'change this section background to color gradient Everything You Need to Grow Your Business'
    );
    expect(stripped.toLowerCase()).not.toContain('gradient');
    expect(stripped).toMatch(/grow your business/i);
  });
});
