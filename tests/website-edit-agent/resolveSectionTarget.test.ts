import { describe, it, expect } from 'vitest';
import {
  buildEnrichedSiteStructure,
  resolveSectionTarget,
  findSectionObjectRanges,
  extractSectionComponentSource,
  titleMatchesIntent,
} from '../../src/lib/project-workspace/website-edit-agent/resolveSectionTarget';

const siteConfig = `export const siteConfig = {
  sections: [
    { type: "services", title: "Our Products", items: [] },
    { type: "testimonials", title: "What Our Customers Say", items: [] },
    { type: "faq", title: "Questions", items: [] },
  ],
};`;

const page = `
function ServicesSection({ section }) {
  return <section className={"py-20 " + preset.surfaceBg}>{section.title}</section>;
}
function TestimonialsSection({ section }) {
  return <section className={"py-20 " + preset.surfaceBg}>{section.title}</section>;
}
function FaqSection({ section }) {
  return <section className={"py-20 " + preset.mutedBg}>{section.title}</section>;
}
function SectionRenderer({ section }) {
  switch (section.type) {
    case "services": return <ServicesSection section={section} />;
    case "testimonials": return <TestimonialsSection section={section} />;
    case "faq": return <FaqSection section={section} />;
    default: return null;
  }
}
{siteConfig.sections.map((s) => <SectionRenderer section={s} />)}
`;

describe('resolveSectionTarget', () => {
  const snapshot = buildEnrichedSiteStructure(siteConfig, page);

  it('maps renderer components and config line ranges', () => {
    expect(snapshot.sections[0].rendererComponent).toBe('ServicesSection');
    expect(snapshot.sections[1].rendererComponent).toBe('TestimonialsSection');
    expect(snapshot.sections[0].configLineRange?.startLine).toBeGreaterThan(0);
  });

  it('resolves first section to sections[0] not hero', () => {
    const result = resolveSectionTarget('change background of first section', [], snapshot);
    expect(result.confidence).toBe('high');
    expect(result.sectionIndex).toBe(0);
    expect(result.sectionType).toBe('services');
  });

  it('resolves second and last section ordinals', () => {
    const second = resolveSectionTarget('update the second section title', [], snapshot);
    expect(second.sectionIndex).toBe(1);

    const last = resolveSectionTarget('edit the last section', [], snapshot);
    expect(last.sectionIndex).toBe(2);
  });

  it('matches quoted and fuzzy titles', () => {
    const result = resolveSectionTarget('edit text in "What Our Customers Say"', [], snapshot);
    expect(result.sectionIndex).toBe(1);
    expect(result.confidence).toBe('high');
    expect(titleMatchesIntent('What Our Customers Say', 'customers say')).toBe(true);
    expect(titleMatchesIntent('Everything You Need to Grow Your Business', 'business')).toBe(
      false
    );
  });

  it('resolves deictic + quoted title + explicit color to the named section', () => {
    const growConfig = siteConfig.replace(
      '{ type: "services", title: "Our Products", items: [] }',
      '{ type: "services", title: "Everything You Need to Grow Your Business", items: [] }'
    ).replace(
      '{ type: "faq", title: "Questions", items: [] }',
      '{ type: "contact", title: "Get Started Today", items: [] }'
    );
    const growSnap = buildEnrichedSiteStructure(growConfig, page);
    const result = resolveSectionTarget(
      'change this section background to blue "Everything You Need to Grow Your Business"',
      [],
      growSnap
    );
    expect(result.confidence).toBe('high');
    expect(result.sectionIndex).toBe(0);
    expect(result.title).toMatch(/grow your business/i);
  });

  it('matches section title after colon (deictic + title suffix)', () => {
    const growConfig = siteConfig.replace(
      '{ type: "services", title: "Our Products", items: [] }',
      '{ type: "services", title: "Everything You Need to Grow Your Business", items: [] }'
    );
    const growSnap = buildEnrichedSiteStructure(growConfig, page);
    const result = resolveSectionTarget(
      'change the background color of this to red: Everything You Need to Grow Your Business',
      [],
      growSnap
    );
    expect(result.confidence).toBe('high');
    expect(result.sectionIndex).toBe(0);
    expect(result.title).toMatch(/grow your business/i);
  });

  it('asks for section when "this" has no title suffix', () => {
    const result = resolveSectionTarget('change the background color of this to red', [], snapshot);
    expect(result.confidence).toBe('low');
    expect(result.clarificationMessage).toMatch(/which section/i);
  });

  it('resolves testimonials type keyword', () => {
    const result = resolveSectionTarget('edit text of testimonials section', [], snapshot);
    expect(result.sectionIndex).toBe(1);
    expect(result.sectionType).toBe('testimonials');
  });

  it('returns medium confidence for hero vs first ambiguity', () => {
    const result = resolveSectionTarget('change the top background to blue', [], snapshot);
    expect(result.confidence).toBe('medium');
    expect(result.clarificationMessage).toMatch(/hero|first content section/i);
  });

  it('returns low confidence when multiple type matches', () => {
    const multiTypeConfig = siteConfig.replace(
      '{ type: "faq", title: "Questions", items: [] }',
      '{ type: "faq", title: "Questions", items: [] },\n    { type: "faq", title: "More Questions", items: [] }'
    );
    const multiSnap = buildEnrichedSiteStructure(multiTypeConfig, page);
    const result = resolveSectionTarget('update the faq section', [], multiSnap);
    expect(result.confidence).toBe('low');
    expect(result.matches?.length).toBeGreaterThan(1);
  });

  it('resolves hero, nav, footer as special targets', () => {
    expect(resolveSectionTarget('change hero headline', [], snapshot).kind).toBe('hero');
    expect(resolveSectionTarget('update nav menu', [], snapshot).kind).toBe('nav');
    expect(resolveSectionTarget('edit footer text', [], snapshot).kind).toBe('footer');
  });

  it('findSectionObjectRanges returns one range per section', () => {
    expect(findSectionObjectRanges(siteConfig)).toHaveLength(3);
  });

  it('extractSectionComponentSource slices component function', () => {
    const block = extractSectionComponentSource(page, 'TestimonialsSection');
    expect(block?.content).toContain('function TestimonialsSection');
    expect(block?.content).not.toContain('function FaqSection');
  });
});
