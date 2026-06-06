import { describe, it, expect } from 'vitest';
import {
  buildGroundedEditContext,
  classifyEditWhat,
} from '../../src/lib/project-workspace/edit-shared/buildGroundedEditContext';
import type { SiteWorkspaceSnapshot } from '../../src/lib/project-workspace/edit-shared/resolveSiteWorkspace';
import { resolveSiteWorkspace } from '../../src/lib/project-workspace/edit-shared/resolveSiteWorkspace';
import {
  createSyntheticWorkspace,
  defaultMultiSectionSiteSpec,
  destroySyntheticWorkspace,
} from '../support/syntheticSiteWorkspace';

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
    expect(classifyEditWhat('change heading color to green')).toBe('style_text');
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

  it('returns undefined plan when snapshot is missing', async () => {
    const result = await buildGroundedEditContext(null, 'change background of first section', []);
    expect(result.plan).toBeUndefined();
  });

  it('includes section catalog on style clarification path', async () => {
    const result = await buildGroundedEditContext(
      makeSnap(),
      'change this section background to blue',
      []
    );

    expect(result.needsClarification).toBe(true);
    expect(result.sectionCatalog?.sections).toHaveLength(2);
    expect(result.clarificationMessage).toContain('Our Products');
    expect(result.suggestedReplies?.[0]).toMatch(/Our Products/);
  });

  it('attaches sectionCatalog on resolved style edit plan', async () => {
    const result = await buildGroundedEditContext(
      makeSnap(),
      'change background of first section to yellow',
      []
    );

    expect(result.plan?.sectionCatalog?.textBlock).toContain('SITE STRUCTURE MAP');
    expect(result.plan?.sectionCatalog?.sections).toHaveLength(2);
  });

  it('resolves numbered section reply after catalog clarification', async () => {
    const spec = defaultMultiSectionSiteSpec();
    const clarification =
      'Which section do you mean? Reply with the number:\n\n' +
      spec.sections
        .map((s, i) => `${i + 1}. [${i}] ${s.type} — "${s.title ?? `Section ${i + 1}`}"`)
        .join('\n');
    const turns = [
      { role: 'user', content: 'Change the background color of this to red' },
      { role: 'assistant', content: clarification },
    ] as const;

    const wp = await createSyntheticWorkspace({
      site: spec,
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    try {
      const snap = await resolveSiteWorkspace({ workspacePath: wp, mode: 'gitlab' });
      const result = await buildGroundedEditContext(snap, '3', [...turns], wp);

      expect(result.needsClarification).toBeFalsy();
      expect(result.plan?.where.sectionIndex).toBe(2);
      expect(result.plan?.what).toBe('style_background');
    } finally {
      await destroySyntheticWorkspace(wp);
    }
  });

  it('resolves color-gradient + quoted grow title to services section (not contact)', async () => {
    const growConfig = siteConfig.replace(
      '{ type: "services", title: "Our Products", items: [] }',
      '{ type: "services", title: "Everything You Need to Grow Your Business", items: [] }'
    ).replace(
      '{ type: "testimonials", title: "What Our Customers Say", items: [] }',
      '{ type: "contact", title: "Get Started Today", items: [] }'
    );
    const growSnap: SiteWorkspaceSnapshot = {
      ...makeSnap(),
      siteConfigContent: growConfig,
    };
    const result = await buildGroundedEditContext(
      growSnap,
      'change this section background to color gradient "Everything You Need to Grow Your Business"',
      []
    );

    expect(result.needsClarification).toBeFalsy();
    expect(result.plan?.where.sectionIndex).toBe(0);
    expect(result.plan?.what).toBe('style_background');
    expect(result.plan?.where.title).toMatch(/grow your business/i);
  });
});
