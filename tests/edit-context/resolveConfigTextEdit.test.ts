import { describe, expect, it } from 'vitest';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import { normalizeMisroutedCopyPlan } from '@/lib/project-workspace/edit-agent/planFromConfigTextEdit';
import { buildSelectedTargetContext } from '@/lib/project-workspace/edit-context/selectedTargetContext';
import {
  extractReplacementValue,
  stripPinnedTargetSuffix,
} from '@/lib/project-workspace/edit-context/configTextEditUtils';
import { enumerateAllowlistedFields } from '@/lib/project-workspace/edit-context/enumerateAllowlistedFields';
import { resolveConfigTextEdit } from '@/lib/project-workspace/edit-context/resolveConfigTextEdit';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

const contactSiteConfig = `export const siteConfig = {
  businessName: "Demo Co",
  contact: { phone: "Display phone number provided by user", email: "1234@asdfasd.edu" },
  sections: [
    {
      type: "contact",
      title: "Get Started Today",
      body: "Ready to get started? Reach out anytime."
    }
  ]
};`;

const contactSelectedTarget = {
  kind: 'section' as const,
  sectionId: 'section_contact_0',
  sectionIndex: 0,
  sectionType: 'contact',
  sectionTitle: 'Get Started Today',
};

function contactEditContext(message: string): EditContext {
  const catalog = buildSiteSectionCatalog(contactSiteConfig, '');
  const target = {
    kind: 'section' as const,
    sectionIndex: 0,
    sectionType: 'contact',
    title: 'Get Started Today',
    confidence: 'high' as const,
    candidates: [],
    needsClarification: false,
  };
  const selectedTargetContext = buildSelectedTargetContext({
    selectedTarget: contactSelectedTarget,
    siteConfigContent: contactSiteConfig,
    pageContent: '',
    catalog,
    target,
  });
  return {
    ownerMessage: message,
    effectiveMessage: message,
    siteModel: { siteConfigContent: contactSiteConfig, archetype: 'gitlab-next' },
    target,
    selectedTarget: contactSelectedTarget,
    selectedTargetContext: selectedTargetContext ?? undefined,
    sections: [{ index: 0, type: 'contact', title: 'Get Started Today' }],
    riskFlags: {
      level: 'low',
      compoundIntent: false,
      lowConfidenceTarget: false,
      infraNotReady: false,
      legacyArchetype: false,
      reasons: [],
    },
    verificationContract: { checks: [] },
    sectionCatalog: catalog,
    selectedSnippets: [],
    allowedWritePaths: [],
    workspacePath: '/tmp',
    mode: 'gitlab',
    infraBaselineReady: true,
  } as unknown as EditContext;
}

describe('resolveConfigTextEdit', () => {
  it('strips UI-selected suffix before extracting values', () => {
    expect(
      extractReplacementValue(
        'change contact information to helllo this is david (UI-selected section: index 0, title "Get Started Today")'
      )
    ).toBe('helllo this is david');
    expect(stripPinnedTargetSuffix('hello (UI-selected section: index 0)')).toBe('hello');
  });

  it('Mode B resolves quoted find/replace across allowlisted fields', () => {
    const result = resolveConfigTextEdit({
      message: 'change "Ready to get started? Reach out anytime." to "Updated body copy"',
      siteConfigContent: contactSiteConfig,
      pinnedSectionIndex: 0,
    });
    expect(result.kind).toBe('apply');
    if (result.kind === 'apply') {
      expect(result.fieldPath).toBe('sections[0].body');
      expect(result.value).toBe('Updated body copy');
      expect(result.mode).toBe('find_replace');
    }
  });

  it('Mode C resolves typed email edits', () => {
    const result = resolveConfigTextEdit({
      message: 'change email to david@example.com',
      siteConfigContent: contactSiteConfig,
      pinnedSectionIndex: 0,
    });
    expect(result.kind).toBe('apply');
    if (result.kind === 'apply') {
      expect(result.fieldPath).toBe('contact.email');
      expect(result.value).toBe('david@example.com');
    }
  });

  it('Mode A resolves pinned contact section copy to section subtitle (inner card heading)', () => {
    const ctx = buildSelectedTargetContext({
      selectedTarget: contactSelectedTarget,
      siteConfigContent: contactSiteConfig,
      pageContent: '',
      catalog: buildSiteSectionCatalog(contactSiteConfig, ''),
      target: contactEditContext('').target,
    });
    const result = resolveConfigTextEdit({
      message: 'change contact information to helllo this is david',
      siteConfigContent: contactSiteConfig,
      pinnedSectionIndex: 0,
      selectedTargetContext: ctx ?? undefined,
    });
    expect(result.kind).toBe('apply');
    if (result.kind === 'apply') {
      expect(result.fieldPath).toBe('sections[0].subtitle');
      expect(result.value).toBe('helllo this is david');
      expect(result.mode).toBe('set_field');
    }
  });

  it('enumerateAllowlistedFields indexes contact and section fields', () => {
    const entries = enumerateAllowlistedFields(contactSiteConfig);
    expect(entries.some((e) => e.fieldPath === 'contact.email')).toBe(true);
    expect(entries.some((e) => e.fieldPath === 'sections[0].body')).toBe(true);
  });

  it('buildDeterministicPlan uses update_config_field via unified resolver', () => {
    const plan = buildDeterministicPlan(
      contactEditContext('change contact information to helllo this is david')
    );
    expect(plan?.needsClarification).toBe(false);
    expect(plan?.steps[0]?.skill).toBe('update_config_field');
    expect(plan?.steps[0]?.params).toMatchObject({
      fieldPath: 'sections[0].subtitle',
      value: 'helllo this is david',
    });
  });

  it('normalizeMisroutedCopyPlan rewrites misrouted update_contact plans', () => {
    const editContext = contactEditContext('change contact information to helllo this is david');
    const rewritten = normalizeMisroutedCopyPlan(
      {
        planVersion: 'website-agent',
        needsClarification: false,
        steps: [
          {
            skill: 'update_contact',
            params: { value: 'helllo this is david', email: '1234@asdfasd.edu' },
          },
        ],
      },
      editContext
    );
    expect(rewritten.steps[0]?.skill).toBe('update_config_field');
    expect(rewritten.steps[0]?.params).toMatchObject({
      fieldPath: 'sections[0].subtitle',
      value: 'helllo this is david',
    });
  });
});
