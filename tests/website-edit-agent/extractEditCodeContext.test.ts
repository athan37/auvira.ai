import { describe, it, expect } from 'vitest';
import {
  extractSiteConfigSectionBlock,
  extractPageSectionBlock,
  extractSectionRendererCase,
  formatCodeContextBlocks,
} from '../../src/lib/project-workspace/website-edit-agent/extractEditCodeContext';
import { buildEnrichedSiteStructure } from '../../src/lib/project-workspace/website-edit-agent/resolveSectionTarget';

const siteConfig = `export const siteConfig = {
  sections: [
    { type: "services", title: "Our Products", body: "We build things", items: [] },
    { type: "testimonials", title: "What Our Customers Say", items: [{ title: "Jane", description: "Great!" }] },
  ],
};`;

const page = `
function ServicesSection({ section }) {
  return <section id="services" className={"px-4 py-20 " + preset.surfaceBg}>{section.title}</section>;
}
function TestimonialsSection({ section }) {
  return <section id="testimonials" className={"px-4 py-20 " + preset.surfaceBg}>{section.title}</section>;
}
function SectionRenderer({ section }) {
  switch (section.type) {
    case "services": return <ServicesSection section={section} />;
    case "testimonials": return <TestimonialsSection section={section} />;
    default: return null;
  }
}
`;

describe('extractEditCodeContext', () => {
  it('slices siteConfig section with line numbers', () => {
    const block = extractSiteConfigSectionBlock(siteConfig, 0);
    expect(block).not.toBeNull();
    expect(block!.label).toBe('siteConfig.sections[0]');
    expect(block!.content).toContain('Our Products');
    expect(block!.startLine).toBeGreaterThan(0);
    expect(block!.endLine).toBeGreaterThanOrEqual(block!.startLine);
  });

  it('slices page component block', () => {
    const block = extractPageSectionBlock(page, 'TestimonialsSection');
    expect(block).not.toBeNull();
    expect(block!.path).toBe('src/app/page.tsx');
    expect(block!.content).toContain('function TestimonialsSection');
  });

  it('extracts SectionRenderer switch case', () => {
    const block = extractSectionRendererCase(page, 'testimonials');
    expect(block?.content).toMatch(/case\s*"testimonials"/);
  });

  it('formatCodeContextBlocks includes labels and paths', () => {
    const configBlock = extractSiteConfigSectionBlock(siteConfig, 1)!;
    const pageBlock = extractPageSectionBlock(page, 'TestimonialsSection')!;
    const formatted = formatCodeContextBlocks([configBlock, pageBlock]);
    expect(formatted).toContain('siteConfig.sections[1]');
    expect(formatted).toContain('TestimonialsSection');
    expect(formatted).toContain('What Our Customers Say');
  });

  it('buildEnrichedSiteStructure attaches ranges used by extraction', async () => {
    const snapshot = buildEnrichedSiteStructure(siteConfig, page);
    expect(snapshot.sections[1].rendererComponent).toBe('TestimonialsSection');
    expect(snapshot.sections[1].pageComponentRange).toBeDefined();
  });
});
