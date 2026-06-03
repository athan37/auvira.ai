import { describe, expect, it } from 'vitest';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import { inferSelectedTargetField } from '@/lib/project-workspace/edit-context/inferSelectedTargetField';
import {
  extractReplacementValue,
  isPinnedContactSectionCopyIntent,
  stripPinnedTargetSuffix,
} from '@/lib/project-workspace/edit-context/pinnedContactSectionCopy';
import { buildSelectedTargetContext } from '@/lib/project-workspace/edit-context/selectedTargetContext';
import { rewriteMisroutedContactCopyPlan } from '@/lib/project-workspace/planner/rewriteMisroutedContactCopyPlan';
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

describe('pinnedContactSectionCopy', () => {
  it('strips UI-selected suffix before extracting values', () => {
    expect(
      extractReplacementValue(
        'change contact information to helllo this is david (UI-selected section: index 0, title "Get Started Today")'
      )
    ).toBe('helllo this is david');
    expect(stripPinnedTargetSuffix('hello (UI-selected section: index 0)')).toBe('hello');
  });

  it('extracts unquoted replacement values', () => {
    expect(
      extractReplacementValue('change contact information to helllo this is david')
    ).toBe('helllo this is david');
  });

  it('detects pinned contact section copy intent', () => {
    const ctx = buildSelectedTargetContext({
      selectedTarget: contactSelectedTarget,
      siteConfigContent: contactSiteConfig,
      pageContent: '',
      catalog: buildSiteSectionCatalog(contactSiteConfig, ''),
      target: contactEditContext('').target,
    });
    expect(
      isPinnedContactSectionCopyIntent(
        'change contact information to helllo this is david',
        ctx ?? undefined
      )
    ).toBe(true);
    expect(
      isPinnedContactSectionCopyIntent('change email to new@example.com', ctx ?? undefined)
    ).toBe(false);
  });

  it('infers section body for vague contact information copy', () => {
    const ctx = buildSelectedTargetContext({
      selectedTarget: contactSelectedTarget,
      siteConfigContent: contactSiteConfig,
      pageContent: '',
      catalog: buildSiteSectionCatalog(contactSiteConfig, ''),
      target: contactEditContext('').target,
    });
    const inferred = inferSelectedTargetField(
      'change contact information to helllo this is david',
      ctx ?? undefined
    );
    expect(inferred?.fieldPath).toBe('sections[0].body');
    expect(inferred?.value).toBe('helllo this is david');
  });

  it('buildDeterministicPlan uses update_config_field for pinned contact copy', () => {
    const plan = buildDeterministicPlan(
      contactEditContext('change contact information to helllo this is david')
    );
    expect(plan?.needsClarification).toBe(false);
    expect(plan?.steps[0]?.skill).toBe('update_config_field');
    expect(plan?.steps[0]?.params).toMatchObject({
      fieldPath: 'sections[0].body',
      value: 'helllo this is david',
    });
  });

  it('rewrites misrouted update_contact plans to section copy', () => {
    const editContext = contactEditContext('change contact information to helllo this is david');
    const rewritten = rewriteMisroutedContactCopyPlan(
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
      fieldPath: 'sections[0].body',
      value: 'helllo this is david',
    });
  });
});
