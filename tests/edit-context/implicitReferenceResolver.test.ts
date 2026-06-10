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

  it('explicit color wins over Monitor intent sentence', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'make the first section red',
      editContext: baseContext({ ownerMessage: 'make the first section red' }),
      projectIntent: {
        sentence: "Change the first section background (sections[0].presentation.backgroundClass) to blue.",
      },
    });
    expect(result.references).toEqual([]);
  });

  it('one-shots favorite color from prior clarify thread without stored metadata', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'change background to my faviorite color',
      editContext: baseContext({
        ownerMessage: 'change background to my faviorite color',
      }),
      recentHistory: [
        { role: 'user', content: 'change the Contact section to my favourite color' },
        {
          role: 'assistant',
          content: 'What color should I use?',
          metadata: { pendingImplicitRef: { phrase: 'my favourite color', kind: 'color' } },
        },
        { role: 'user', content: 'green' },
        { role: 'assistant', content: 'Updated the page content.' },
      ],
    });
    expect(result.needsClarification).toBeUndefined();
    expect(result.references[0]?.resolvedValue).toBe('green');
    expect(result.resolvedMessage).toContain('green');
  });

  it('one-shots favorite color from explicit prior chat statement', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'change background to my favorite color',
      editContext: baseContext({
        ownerMessage: 'change background to my favorite color',
      }),
      recentHistory: [
        { role: 'user', content: 'btw my favorite color is blue' },
        { role: 'assistant', content: 'Got it — I will keep that in mind for styling edits.' },
      ],
    });
    expect(result.needsClarification).toBeUndefined();
    expect(result.references[0]?.resolvedValue).toBe('blue');
  });

  it('resolves favorite color from Monitor intent sentence', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'make the background my favorite color',
      editContext: baseContext(),
      projectIntent: {
        sentence:
          "Change the contact section background (sections[1].presentation.backgroundClass) to blue, the owner's favorite color.",
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

  it('resolves usual CTA from Monitor intent sentence when history is empty', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'change this to our usual CTA',
      editContext: baseContext({ ownerMessage: 'change this to our usual CTA' }),
      projectIntent: {
        sentence: 'Change the hero CTA (hero.primaryCta) to "Schedule Service".',
      },
    });
    expect(result.references[0]?.resolvedValue).toBe('Schedule Service');
    expect(result.references[0]?.source).toBe('project_intent');
  });

  it('resolves favorite color from Monitor intent sentence with concrete color', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'make it my favorite color',
      editContext: baseContext({ ownerMessage: 'make it my favorite color' }),
      projectIntent: {
        sentence:
          "Change the contact card background (sections[1].presentation.cardClass) to blue, the owner's favorite color.",
      },
    });
    expect(result.needsClarification).toBeUndefined();
    expect(result.references[0]?.resolvedValue).toBe('blue');
    expect(result.references[0]?.source).toBe('project_intent');
  });

  it('still clarifies when Monitor intent sentence is unresolved', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'make it my favorite color',
      editContext: baseContext({ ownerMessage: 'make it my favorite color' }),
      projectIntent: {
        sentence:
          "Change the contact section background to the owner's favorite color; color not yet known from project history.",
      },
    });
    expect(result.needsClarification).toBe(true);
    expect(result.clarificationMessage).toContain('color');
  });

  it('uses most recent favorite-color resolution when history has both red and green', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'change background to my favorite color',
      editContext: baseContext({
        ownerMessage: 'change background to my favorite color',
      }),
      recentHistory: [
        { role: 'user', content: 'change background my favorite color' },
        { role: 'assistant', content: 'What color should I use?' },
        { role: 'user', content: 'red' },
        {
          role: 'assistant',
          content: 'Updated.',
          metadata: {
            resolvedReferences: [
              { phrase: 'my favorite color', resolvedValue: 'red', source: 'explicit_message' },
            ],
          },
        },
        { role: 'user', content: 'change background my favorite color' },
        { role: 'assistant', content: 'What color should I use?' },
        { role: 'user', content: 'green' },
        {
          role: 'assistant',
          content: 'Updated.',
          metadata: {
            resolvedReferences: [
              { phrase: 'my favorite color', resolvedValue: 'green', source: 'explicit_message' },
            ],
          },
        },
      ],
    });
    expect(result.needsClarification).toBeUndefined();
    expect(result.references[0]?.resolvedValue).toBe('green');
  });

  it('resolves favorite color from prior resolvedReferences despite noisy chat colors', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'make the Contact section background my favorite color',
      editContext: baseContext({
        ownerMessage: 'make the Contact section background my favorite color',
      }),
      recentHistory: [
        { role: 'user', content: 'change to red to blue gradient background' },
        { role: 'assistant', content: 'Updated background to a color gradient.' },
        { role: 'user', content: 'change background my favourite color' },
        { role: 'assistant', content: 'What color should I use?' },
        { role: 'user', content: 'green' },
        {
          role: 'assistant',
          content: 'Updated the page content.',
          metadata: {
            resolvedReferences: [
              {
                phrase: 'my favourite color',
                resolvedValue: 'green',
                source: 'explicit_message',
              },
            ],
          },
        },
      ],
    });
    expect(result.needsClarification).toBeUndefined();
    expect(result.references[0]?.resolvedValue).toBe('green');
    expect(result.references[0]?.source).toBe('chat_history');
  });

  it('does not modify edit target', async () => {
    const ctx = baseContext();
    const beforeTarget = { ...ctx.target };
    await resolveImplicitReferences({
      ownerMessage: 'make the background my favorite color',
      editContext: ctx,
      projectIntent: {
        sentence: 'Change the section background (sections[0].presentation.backgroundClass) to blue.',
      },
    });
    expect(ctx.target).toEqual(beforeTarget);
  });

  it('resolves pending color clarification from assistant metadata', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'Green',
      editContext: baseContext({ ownerMessage: 'Green' }),
      recentHistory: [
        { role: 'user', content: 'change background my favorite color' },
        {
          role: 'assistant',
          content: 'What color should I use?',
          metadata: {
            pendingImplicitRef: { phrase: 'my favorite color', kind: 'color' },
          },
        },
      ],
    });
    expect(result.needsClarification).toBeUndefined();
    expect(result.references[0]?.resolvedValue).toBe('green');
  });
});
