import { describe, expect, it } from 'vitest';
import { resolveImplicitReferences } from '@/lib/project-workspace/edit-context/implicitReferenceResolver';
import { rankProjectMemorySlots } from '@/lib/project-workspace/edit-context/projectMemoryRanker';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import type { ObservabilityProjectMemory } from '@/lib/observability/types';

function contactContext(): EditContext {
  return {
    workspacePath: '/tmp',
    mode: 'gitlab',
    ownerMessage: 'use my favorite way to edit this section',
    effectiveMessage: 'use my favorite way to edit this section',
    siteModel: {} as EditContext['siteModel'],
    sectionCatalog: { textBlock: '', sections: [] } as EditContext['sectionCatalog'],
    sections: [{ index: 1, type: 'contact', title: 'Contact' }],
    target: {
      kind: 'section',
      sectionIndex: 1,
      sectionType: 'contact',
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
  };
}

const sampleMemory: ObservabilityProjectMemory = {
  turn_count: 3,
  updated_at: '2026-06-09T12:00:00Z',
  slots: [
    {
      id: 'pattern-contact',
      kind: 'edit_pattern',
      phrase_aliases: ['my favorite way to edit', 'usual contact edit'],
      value: {
        what: 'style_card',
        params: { presentationField: 'cardClass', backgroundClass: 'gradient-blue' },
      },
      scope: { type: 'section_type', sectionType: 'contact' },
    },
    {
      id: 'color-global',
      kind: 'color',
      phrase_aliases: ['my favorite color'],
      value: 'blue',
      scope: { type: 'project' },
    },
  ],
};

describe('projectMemoryRanker', () => {
  it('prefers section-scoped edit_pattern for this_section hint', () => {
    const ranked = rankProjectMemorySlots(
      sampleMemory,
      {
        phrase: 'my favorite way to edit',
        kind: 'edit_pattern',
        scopeHint: 'this_section',
      },
      contactContext()
    );
    expect(ranked[0]?.value).toContain('style_card');
    expect(ranked[0]?.source).toBe('project_memory');
  });
});

describe('resolveImplicitReferences with project memory', () => {
  it('resolves favorite color from memory slots', async () => {
    const result = await resolveImplicitReferences({
      ownerMessage: 'background my favorite color',
      editContext: contactContext(),
      projectMemory: sampleMemory,
    });
    expect(result.references[0]?.resolvedValue).toBe('blue');
    expect(result.references[0]?.source).toBe('project_memory');
  });
});
