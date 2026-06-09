import { describe, expect, it } from 'vitest';
import { canonicalizeConfigFieldPath } from '@/lib/project-workspace/edit-context/configFieldPaths';
import { canonicalizePlanConfigFieldPaths } from '@/lib/project-workspace/planner/canonicalizePlanConfigFieldPaths';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

function minimalContext(overrides: Partial<EditContext> = {}): EditContext {
  return {
    workspacePath: '/tmp',
    mode: 'gitlab',
    ownerMessage: "We'd love to hear from you",
    effectiveMessage: "We'd love to hear from you",
    siteModel: { workspacePath: '/tmp', mode: 'gitlab', archetype: 'section-loop' } as EditContext['siteModel'],
    sectionCatalog: { textBlock: '', sections: [] } as EditContext['sectionCatalog'],
    sections: [{ index: 0, type: 'contact', title: 'Get Started Today' }],
    target: {
      kind: 'section',
      sectionIndex: 0,
      title: 'Get Started Today',
      sectionType: 'contact',
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
    selectedTargetContext: {
      target: { kind: 'section', sectionIndex: 0, sectionType: 'contact', sectionTitle: 'Get Started Today' },
      resolved: {
        kind: 'section',
        sectionIndex: 0,
        sectionTitle: 'Get Started Today',
        sectionType: 'contact',
        confidence: 'high',
      },
      editableFields: [{ fieldPath: 'sections[0].subtitle', label: 'subtitle', value: 'Contact Information' }],
      recommendedDefaultField: {
        fieldPath: 'sections[0].subtitle',
        reason: 'contact inner card heading',
      },
      allowedFieldPaths: ['sections[0].subtitle'],
      pinnedElementOnly: true,
    } as EditContext['selectedTargetContext'],
    ...overrides,
  };
}

describe('canonicalizeConfigFieldPath', () => {
  it('passes through canonical paths', () => {
    expect(canonicalizeConfigFieldPath('sections[0].subtitle', minimalContext())).toBe(
      'sections[0].subtitle'
    );
  });

  it('expands bare subtitle using pinned section index', () => {
    expect(canonicalizeConfigFieldPath('subtitle', minimalContext())).toBe('sections[0].subtitle');
  });
});

describe('canonicalizePlanConfigFieldPaths', () => {
  it('rewrites LLM update_config_field step with bare subtitle', () => {
    const plan = canonicalizePlanConfigFieldPaths(
      {
        planVersion: 'website-agent',
        needsClarification: false,
        steps: [
          {
            skill: 'update_config_field',
            params: { fieldPath: 'subtitle', value: "We'd love to hear from you" },
          },
        ],
      },
      minimalContext()
    );

    expect(plan.steps[0]?.params).toMatchObject({
      fieldPath: 'sections[0].subtitle',
      value: "We'd love to hear from you",
    });
  });
});
