import { describe, it, expect } from 'vitest';
import {
  detectAmbiguousEditRequest,
  detectScopedStyleRequest,
  resolveEffectiveEditMessage,
  tryResolveScopedStyleFromHistory,
  formatConversationForPrompt,
} from '../../src/lib/project-workspace/website-edit-agent/editAmbiguity';
import { buildGroundedEditContext } from '../../src/lib/project-workspace/website-edit-agent/buildGroundedEditContext';
import type { SiteWorkspaceSnapshot } from '../../src/lib/project-workspace/website-edit-agent/resolveSiteWorkspace';

const snap: SiteWorkspaceSnapshot = {
  mode: 'gitlab',
  archetype: 'section_loop',
  siteConfigPath: 'src/lib/siteConfig.ts',
  pagePath: 'src/app/page.tsx',
  siteConfigContent: `export const siteConfig = {
    sections: [
      { type: "services", title: "Our Products", items: [] },
      { type: "testimonials", title: "What Our Customers Say", items: [] },
    ],
  };`,
  pageContent: `
function ServicesSection() { return null; }
function TestimonialsSection() { return null; }
function SectionRenderer({ section }) {
  switch (section.type) {
    case "services": return <ServicesSection />;
    case "testimonials": return <TestimonialsSection />;
  }
}`,
  indexHtmlPath: null,
  siteJsonPath: null,
  stylesPath: null,
  indexHtmlContent: null,
  siteJsonContent: null,
};

describe('editAmbiguity', () => {
  const examplePrompt =
    'change the card below to red in the section what our customers say to red';

  it('detects scoped style request for card+section+color', () => {
    expect(detectScopedStyleRequest(examplePrompt)).toBe(true);
  });

  it('flags card+section+color as ambiguous', () => {
    const result = detectAmbiguousEditRequest(examplePrompt);
    expect(result.ambiguous).toBe(true);
    expect(result.clarificationMessage).toMatch(/What Our Customers Say|testimonial/i);
    expect(result.suggestedReplies?.length).toBe(3);
  });

  it('detects deictic "below" as ambiguous with scoped style', () => {
    const result = detectAmbiguousEditRequest('change the card below to blue in testimonials');
    expect(result.ambiguous).toBe(true);
  });

  it('flags deictic "this" without section title as ambiguous', () => {
    const result = detectAmbiguousEditRequest('change the background color of this to red');
    expect(result.ambiguous).toBe(true);
    expect(result.clarificationMessage).toMatch(/which section/i);
  });

  it('does not treat colon section title as ambiguous when target is clear', () => {
    const result = detectAmbiguousEditRequest(
      'change the background color of this to red: Everything You Need to Grow Your Business'
    );
    expect(result.ambiguous).toBe(false);
  });

  it('resolves follow-up "1" when history contains clarification', () => {
    const history = [
      { role: 'user' as const, content: examplePrompt },
      {
        role: 'assistant' as const,
        content: 'Reply with 1, 2, or 3 — testimonial cards clarification.',
      },
    ];
    const result = detectAmbiguousEditRequest('1', history);
    expect(result.ambiguous).toBe(false);
    expect(result.confidence).toBe('high');
  });

  it('resolveEffectiveEditMessage expands "1" with prior color', () => {
    const history = [
      { role: 'user' as const, content: examplePrompt },
      { role: 'assistant' as const, content: 'Reply with 1, 2, or 3' },
    ];
    const effective = resolveEffectiveEditMessage('1', history);
    expect(effective).toMatch(/testimonial card backgrounds/i);
    expect(effective).toMatch(/red/i);
  });

  it('tryResolveScopedStyleFromHistory maps option 1 to allTestimonialCards', () => {
    const history = [
      { role: 'user' as const, content: examplePrompt },
      { role: 'assistant' as const, content: 'Reply with 1, 2, or 3' },
    ];
    const resolved = tryResolveScopedStyleFromHistory('1', history);
    expect(resolved.resolved).toBe(true);
    expect(resolved.scope).toBe('allTestimonialCards');
    expect(resolved.targetColor).toBe('red');
  });

  it('formatConversationForPrompt includes recent turns', () => {
    const block = formatConversationForPrompt([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ]);
    expect(block).toContain('CONVERSATION CONTEXT');
    expect(block).toContain('★★★ Assistant');
    expect(block).toContain('hello');
    expect(block).toContain('hi there');
  });

  it('uses EditTargetPlan WHERE clarification for multiple section matches', () => {
    const result = detectAmbiguousEditRequest('change this section', [], {
      where: {
        confidence: 'low',
        kind: 'section',
        clarificationMessage: 'I found two sections that could match. Reply with the number:\n\n1. [0] services',
        suggestedReplies: ['1 — Our Products'],
      },
      what: 'style_background',
      valueExplicit: false,
      codeBlocks: [],
      structureBrief: '',
    });
    expect(result.ambiguous).toBe(true);
    expect(result.clarificationMessage).toMatch(/Reply with the number/i);
  });
});
