import { describe, expect, it } from 'vitest';
import {
  buildFieldClarification,
  inferSelectedTargetField,
} from '@/lib/project-workspace/edit-context/inferSelectedTargetField';
import { buildSelectedTargetContext } from '@/lib/project-workspace/edit-context/selectedTargetContext';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

const siteConfig = `export const siteConfig = {
  businessName: "Acme",
  sections: [
    { type: "services", title: "Our Services", body: "Full service HVAC." }
  ]
};`;

const selectedTarget = {
  kind: 'section' as const,
  sectionId: 'section_services_1',
  sectionIndex: 0,
  sectionType: 'services',
  sectionTitle: 'Our Services',
};

function baseEditContext(message: string): EditContext {
  const catalog = buildSiteSectionCatalog(siteConfig, '');
  const target = {
    kind: 'section' as const,
    sectionIndex: 0,
    sectionType: 'services',
    title: 'Our Services',
    confidence: 'high' as const,
    candidates: [],
    needsClarification: false,
  };
  const selectedTargetContext = buildSelectedTargetContext({
    selectedTarget,
    siteConfigContent: siteConfig,
    pageContent: '',
    catalog,
    target,
  });
  return {
    ownerMessage: message,
    effectiveMessage: message,
    siteModel: { siteConfigContent: siteConfig, archetype: 'gitlab-next' },
    target,
    selectedTarget,
    selectedTargetContext: selectedTargetContext ?? undefined,
    sections: [{ index: 0, type: 'services', title: 'Our Services' }],
    riskFlags: { level: 'low', compoundIntent: false, lowConfidenceTarget: false, infraNotReady: false, legacyArchetype: false, reasons: [] },
    verificationContract: { checks: [] },
    sectionCatalog: catalog,
    selectedSnippets: [],
    allowedWritePaths: [],
    workspacePath: '/tmp',
    mode: 'gitlab',
    infraBaselineReady: true,
  } as unknown as EditContext;
}

describe('inferSelectedTargetField', () => {
  it('infers title path and value for pinned "change the title to …"', () => {
    const ctx = buildSelectedTargetContext({
      selectedTarget,
      siteConfigContent: siteConfig,
      pageContent: '',
      catalog: buildSiteSectionCatalog(siteConfig, ''),
      target: baseEditContext('').target,
    });
    const inferred = inferSelectedTargetField(
      'change the title to "Hi, this is a title"',
      ctx ?? undefined
    );
    expect(inferred?.fieldPath).toBe('sections[0].title');
    expect(inferred?.value).toBe('Hi, this is a title');
    expect(inferred?.confidence).toBe('high');
  });

  it('skips copy inference for style requests', () => {
    const ctx = buildSelectedTargetContext({
      selectedTarget,
      siteConfigContent: siteConfig,
      pageContent: '',
      catalog: buildSiteSectionCatalog(siteConfig, ''),
      target: baseEditContext('').target,
    });
    const inferred = inferSelectedTargetField('make it black', ctx ?? undefined);
    expect(inferred?.skipCopyInference).toBe(true);
  });

  it('builds field clarification instead of section list', () => {
    const ctx = buildSelectedTargetContext({
      selectedTarget,
      siteConfigContent: siteConfig,
      pageContent: '',
      catalog: buildSiteSectionCatalog(siteConfig, ''),
      target: baseEditContext('').target,
    });
    expect(ctx).toBeTruthy();
    const clarify = buildFieldClarification(ctx!);
    expect(clarify?.message).toMatch(/Which field/i);
    expect(clarify?.suggestedReplies.length).toBeGreaterThanOrEqual(2);
  });
});

describe('buildDeterministicPlan pinned copy', () => {
  it('returns update_config_field for pinned title edit without section name in message', () => {
    const plan = buildDeterministicPlan(
      baseEditContext('change the title to "Hi, this is a title"')
    );
    expect(plan?.needsClarification).toBe(false);
    expect(plan?.steps[0]?.skill).toBe('update_config_field');
    expect(plan?.steps[0]?.params).toMatchObject({
      fieldPath: 'sections[0].title',
      value: 'Hi, this is a title',
    });
  });
});
