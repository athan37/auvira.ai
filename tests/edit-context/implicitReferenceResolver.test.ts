import { describe, expect, it } from 'vitest';
import { resolveImplicitReferences } from '@/lib/project-workspace/edit-context/implicitReferenceResolver';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

function baseContext(overrides: Partial<EditContext> = {}): EditContext {
  return {
    workspacePath: '/tmp',
    mode: 'gitlab',
    ownerMessage: 'make background my favorite color',
    effectiveMessage: 'make background my favorite color',
    siteModel: {
      workspacePath: '/tmp',
      mode: 'gitlab',
      archetype: 'section-loop',
      siteConfigContent: `export const siteConfig = {
  "businessName": "Demo",
  "hero": { "headline": "Hero", "primaryCta": "Get Started" },
  "sections": [
    { "type": "hero", "title": "Hero", "presentation": { "backgroundClass": "gradient-blue" } },
    { "type": "contact", "title": "Contact" }
  ]
} as const;`,
      parsedConfig: {
        businessName: 'Demo',
        hero: { headline: 'Hero', primaryCta: 'Get Started' },
        sections: [
          { type: 'hero', title: 'Hero', presentation: { backgroundClass: 'gradient-blue' } },
          { type: 'contact', title: 'Contact' },
        ],
      },
    } as unknown as EditContext['siteModel'],
    sectionCatalog: { textBlock: '', sections: [] } as unknown as EditContext['sectionCatalog'],
    sections: [
      { index: 0, type: 'hero', title: 'Hero', presentation: { backgroundClass: 'gradient-blue' } },
      { index: 1, type: 'contact', title: 'Contact' },
    ],
    target: {
      kind: 'section',
      sectionIndex: 1,
      title: 'Contact',
      confidence: 'high',
      candidates: [],
      needsClarification: false,
    },
    selectedSnippets: [],
    allowedWritePaths: [],
    riskFlags: {
      level: 'low',
      compoundIntent: false,
      lowConfidenceTarget: false,
      infraNotReady: false,
      legacyArchetype: false,
      reasons: [],
    },
    verificationContract: { checks: [] },
    infraBaselineReady: true,
    ...overrides,
  };
}

describe('resolveImplicitReferences deterministic', () => {
  it('returns empty references when no implicit phrase is present', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'make the contact section background green',
      editContext: baseContext(),
    });
    expect(result.references).toEqual([]);
    expect(result.needsClarification).toBeUndefined();
  });

  it('explicit color wins over project intent favorite color', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'make the first section red',
      editContext: baseContext({ ownerMessage: 'make the first section red' }),
      projectIntent: {
        keywords: ['favorite color blue', 'brand'],
        intents: [],
        turn_count: 3,
        updated_at: null,
      },
    });
    expect(result.references).toEqual([]);
  });

  it('resolves favorite color from projectIntent keywords', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'make the background my favorite color',
      editContext: baseContext(),
      projectIntent: {
        keywords: ['favorite color blue', 'hvac'],
        intents: [],
        turn_count: 2,
        updated_at: null,
      },
    });
    expect(result.needsClarification).toBeUndefined();
    expect(result.references[0]?.resolvedValue).toBe('blue');
    expect(result.references[0]?.source).toBe('project_intent');
    expect(result.resolvedMessage).toContain('blue');
  });

  it('asks clarification when favorite color has no evidence', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'make the background my favorite color',
      editContext: baseContext(),
    });
    expect(result.needsClarification).toBe(true);
    expect(result.clarificationMessage).toContain('color');
  });

  it('resolves usual CTA from chat history', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'change this to our usual CTA',
      editContext: baseContext({
        ownerMessage: 'change this to our usual CTA',
        target: {
          kind: 'section',
          sectionIndex: 0,
          confidence: 'high',
          candidates: [],
          needsClarification: false,
        },
        conversationHistory: [
          { role: 'assistant', content: 'Updated CTA to "Book Now" on hero button.' },
        ],
      }),
    });
    expect(result.references[0]?.resolvedValue).toBe('Book Now');
    expect(result.references[0]?.resolvedKind).toBe('cta');
  });

  it('resolves same style as hero when hero presentation exists', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'make it same style as hero',
      editContext: baseContext({
        ownerMessage: 'make it same style as hero',
      }),
    });
    expect(result.references[0]?.resolvedValue).toBe('gradient-blue');
    expect(result.references[0]?.resolvedKind).toBe('style');
  });

  it('resolves usual CTA from project intent labels when history is empty', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'change this to our usual CTA',
      editContext: baseContext({ ownerMessage: 'change this to our usual CTA' }),
      projectIntent: {
        keywords: ['cta'],
        intents: [{ label: 'CTA Schedule Service', count: 4 }],
        turn_count: 3,
        updated_at: null,
      },
    });
    expect(result.references[0]?.resolvedValue).toBe('Schedule Service');
    expect(result.references[0]?.source).toBe('project_intent');
  });

  it('clarifies when project vocabulary lists multiple distinct colors', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'make it my favorite color',
      editContext: baseContext({ ownerMessage: 'make it my favorite color' }),
      projectIntent: {
        keywords: ['favorite color blue', 'accent green'],
        intents: [],
        turn_count: 2,
        updated_at: null,
      },
    });
    expect(result.needsClarification).toBe(true);
    expect(result.suggestedReplies).toEqual(expect.arrayContaining(['blue', 'green']));
  });

  it('does not modify edit target', async () => {
    const ctx = baseContext();
    const beforeTarget = { ...ctx.target };
    await resolveImplicitReferences({
      ownerMessage: 'make the background my favorite color',
      editContext: ctx,
      projectIntent: {
        keywords: ['blue'],
        intents: [],
        turn_count: 1,
        updated_at: null,
      },
    });
    expect(ctx.target).toEqual(beforeTarget);
  });
});
