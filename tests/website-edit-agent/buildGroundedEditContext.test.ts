import { describe, it, expect } from 'vitest';
import {
  buildGroundedEditContext,
  classifyEditWhat,
} from '../../src/lib/project-workspace/website-edit-agent/buildGroundedEditContext';
import type { SiteWorkspaceSnapshot } from '../../src/lib/project-workspace/website-edit-agent/resolveSiteWorkspace';

const siteConfig = `export const siteConfig = {
  sections: [
    { type: "services", title: "Our Products", items: [] },
    { type: "testimonials", title: "What Our Customers Say", items: [] },
  ],
};`;

const page = `
function ServicesSection({ section }) {
  return <section className={"py-20 " + preset.surfaceBg}>{section.title}</section>;
}
function TestimonialsSection({ section }) {
  return <section className={"py-20 " + preset.surfaceBg}>{section.title}</section>;
}
function SectionRenderer({ section }) {
  switch (section.type) {
    case "services": return <ServicesSection section={section} />;
    case "testimonials": return <TestimonialsSection section={section} />;
    default: return null;
  }
}
{siteConfig.sections.map((s) => <SectionRenderer section={s} />)}
`;

function makeSnap(): SiteWorkspaceSnapshot {
  return {
    mode: 'gitlab',
    archetype: 'section_loop',
    siteConfigPath: 'src/lib/siteConfig.ts',
    pagePath: 'src/app/page.tsx',
    siteConfigContent: siteConfig,
    pageContent: page,
    indexHtmlPath: null,
    siteJsonPath: null,
    stylesPath: null,
    indexHtmlContent: null,
    siteJsonContent: null,
  };
}

describe('buildGroundedEditContext', () => {
  it('classifies background vs copy WHAT signals', () => {
    expect(classifyEditWhat('change background of first section to yellow')).toBe('style_background');
    expect(classifyEditWhat('edit text of testimonials section')).toBe('copy');
  });

  it('end-to-end: first section background resolves sections[0] blocks', async () => {
    const result = await buildGroundedEditContext(
      makeSnap(),
      'change background of first section to yellow',
      []
    );

    expect(result.needsClarification).toBeFalsy();
    expect(result.plan?.where.sectionIndex).toBe(0);
    expect(result.plan?.what).toBe('style_background');
    expect(result.plan?.codeBlocks.length).toBeGreaterThan(0);
    expect(result.plan?.codeBlocks.some((b) => b.label.includes('siteConfig.sections[0]'))).toBe(
      true
    );
    expect(
      result.plan?.codeBlocks.some((b) => b.content.includes('ServicesSection'))
    ).toBe(true);
  });

  it('asks for copy value when section text edit has no explicit target', async () => {
    const result = await buildGroundedEditContext(
      makeSnap(),
      'edit text of testimonials section',
      []
    );

    expect(result.needsClarification).toBe(true);
    expect(result.clarificationMessage).toMatch(/new text/i);
  });

  it('resolves testimonials section for explicit copy', async () => {
    const result = await buildGroundedEditContext(
      makeSnap(),
      'change testimonials section title to "Happy Clients"',
      []
    );

    expect(result.plan?.where.sectionIndex).toBe(1);
    expect(result.plan?.what).toBe('copy');
    expect(result.plan?.valueExplicit).toBe(true);
  });

  it('returns undefined plan for static mode', async () => {
    const result = await buildGroundedEditContext(
      { ...makeSnap(), mode: 'static' },
      'change background of first section',
      []
    );
    expect(result.plan).toBeUndefined();
  });
});
