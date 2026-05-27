import { describe, it, expect } from 'vitest';
import { classifyEditJob } from '../../src/lib/project-workspace/website-edit-agent/editJobClassifier';
import { buildGroundedEditContext } from '../../src/lib/project-workspace/website-edit-agent/buildGroundedEditContext';
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
`;

const snap: SiteWorkspaceSnapshot = {
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

describe('editJobClassifier', () => {
  it('routes site-wide color swap to preset_theme L0', () => {
    const plan = classifyEditJob('change background color from red to yellow throughout the site');
    expect(plan.primaryStrategy).toBe('preset_theme');
    expect(plan.tier).toBe('L0');
    expect(plan.confidence).toBe('high');
  });

  it('routes headline text color to preset_text_color', () => {
    const plan = classifyEditJob('Change the hero headline to black');
    expect(plan.primaryStrategy).toBe('preset_text_color');
    expect(plan.tier).toBe('L0');
  });

  it('routes explicit headline copy to copy_field', () => {
    const plan = classifyEditJob('Change the hero headline to: Summer Sale');
    expect(plan.primaryStrategy).toBe('copy_field');
    expect(plan.verifyProfile).toBe('copy');
  });

  it('routes contact phone update to contact_field', () => {
    const plan = classifyEditJob('change phone to 555-9999');
    expect(plan.primaryStrategy).toBe('contact_field');
  });

  it('detects compound intent as low confidence agent', () => {
    const plan = classifyEditJob('make the site yellow and add an FAQ section');
    expect(plan.confidence).toBe('low');
    expect(plan.needsClarification).toBe(true);
  });

  it('routes gallery description follow-up to gallery_captions strategy', () => {
    const plan = classifyEditJob('add some descriptions to these images too');
    expect(plan.primaryStrategy).toBe('gallery_captions');
    expect(plan.tier).toBe('L1');
  });

  it('requires attachments when owner asks to place an image', () => {
    const plan = classifyEditJob('add this image to the first section', []);
    expect(plan.needsClarification).toBe(true);
    expect(plan.clarificationMessage).toMatch(/attach the image/i);
  });

  it('asks for clarification on ambiguous card+section+color prompt (not section_config)', () => {
    const prompt =
      'change the card below to red in the section what our customers say to red';
    const plan = classifyEditJob(prompt, [], { mode: 'gitlab' } as never);
    expect(plan.needsClarification).toBe(true);
    expect(plan.primaryStrategy).not.toBe('section_config');
    expect(plan.clarificationMessage).toMatch(/testimonial cards|Reply with 1, 2, or 3/i);
    expect(plan.suggestedReplies?.length).toBeGreaterThan(0);
  });

  it('routes hero background color to preset_theme', () => {
    const plan = classifyEditJob('change hero background from blue to green');
    expect(plan.primaryStrategy).toBe('preset_theme');
    expect(plan.needsClarification).toBeFalsy();
  });

  it('routes clarification follow-up "1" to preset_card_color with history', () => {
    const history = [
      {
        role: 'user' as const,
        content: 'change the card below to red in the section what our customers say to red',
      },
      {
        role: 'assistant' as const,
        content:
          'Reply with 1, 2, or 3 — Background of all testimonial cards, one card, or text color.',
      },
    ];
    const plan = classifyEditJob('1', [], { mode: 'gitlab' } as never, history);
    expect(plan.needsClarification).toBeFalsy();
    expect(plan.primaryStrategy).toBe('preset_card_color');
  });

  it('routes grounded first-section background via buildGroundedEditContext', async () => {
    const grounded = await buildGroundedEditContext(
      snap,
      'change background of first section to blue',
      []
    );
    const plan = classifyEditJob(
      'change background of first section to blue',
      [],
      snap,
      [],
      grounded.plan
    );
    expect(plan.primaryStrategy).toBe('section_style');
    expect(plan.tier).toBe('L0');
    expect(plan.primaryStrategy).not.toBe('preset_theme');
  });

  it('routes grounded section copy with value to section_copy_field', () => {
    const editTargetPlan = {
      where: {
        confidence: 'high' as const,
        kind: 'section' as const,
        sectionIndex: 1,
        sectionType: 'testimonials',
        title: 'What Our Customers Say',
        rendererComponent: 'TestimonialsSection',
      },
      what: 'copy' as const,
      valueExplicit: true,
      codeBlocks: [],
      structureBrief: '',
    };
    const plan = classifyEditJob(
      'change testimonials section title to: Happy Clients',
      [],
      { mode: 'gitlab' } as never,
      [],
      editTargetPlan
    );
    expect(plan.primaryStrategy).toBe('section_copy_field');
  });
});
