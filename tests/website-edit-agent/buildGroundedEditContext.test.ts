import { describe, it, expect } from 'vitest';
import {
  buildGroundedEditContext,
  classifyEditWhat,
} from '../../src/lib/project-workspace/website-edit-agent/buildGroundedEditContext';
import type { SiteWorkspaceSnapshot } from '../../src/lib/project-workspace/website-edit-agent/resolveSiteWorkspace';
import { resolveSiteWorkspace } from '../../src/lib/project-workspace/website-edit-agent/resolveSiteWorkspace';
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

  it('routes testimonial card option "1" to preset_card_color via grounded plan', async () => {
    const spec = defaultMultiSectionSiteSpec();
    const testimonialsTitle = spec.sections[3].title!;
    const clarification =
      `I can change something in "${testimonialsTitle}" to red, but I need one detail:\n\n` +
      '1. Background of **all** testimonial cards\n' +
      '2. Background of **one** card (paste the customer name or quote)\n' +
      '3. **Text** color in that section\n\n' +
      'Reply with 1, 2, or 3 — or describe exactly which card and whether you mean background or text.';
    const turns = [
      {
        role: 'user' as const,
        content: `change the card below to red in the section ${testimonialsTitle} to red`,
      },
      { role: 'assistant' as const, content: clarification },
    ];

    const wp = await createSyntheticWorkspace({
      site: spec,
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    try {
      const snap = await resolveSiteWorkspace({ workspacePath: wp, mode: 'gitlab' });
      const grounded = await buildGroundedEditContext(snap, '1', turns, wp);
      const { classifyEditJob } = await import(
        '../../src/lib/project-workspace/website-edit-agent/editJobClassifier'
      );
      const plan = classifyEditJob('1', [], snap, turns, grounded.plan);

      expect(grounded.plan?.what).toBe('style_card');
      expect(plan.primaryStrategy).toBe('preset_card_color');
    } finally {
      await destroySyntheticWorkspace(wp);
    }
  });
});
