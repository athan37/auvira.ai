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

  it('Mode C resolves add-my-phone-number phrasing on pinned contact inner card', () => {
    const config = `export const siteConfig = {
      businessName: "Demo Co",
      contact: {},
      sections: [
        {
          type: "contact",
          title: "Contact Us",
          body: "Reach out."
        }
      ]
    };`;
    const pinnedSubtitle = {
      ...contactSelectedTarget,
      sectionTitle: 'Contact Us',
      fieldPath: 'sections[0].subtitle',
      elementKind: 'heading',
      elementLabel: 'Contact Information',
      pinScope: 'element' as const,
      targetChain: [
        { role: 'section' as const, kind: 'contact', label: 'Contact Us' },
        { role: 'container' as const, kind: 'inner_card', label: 'Contact card' },
        {
          role: 'element' as const,
          kind: 'heading',
          label: 'Contact Information',
          fieldPath: 'sections[0].subtitle',
        },
      ],
    };
    const selectedTargetContext = buildSelectedTargetContext({
      selectedTarget: pinnedSubtitle,
      siteConfigContent: config,
      pageContent: '',
      catalog: buildSiteSectionCatalog(config, ''),
      target: {
        kind: 'section' as const,
        sectionIndex: 0,
        sectionType: 'contact',
        title: 'Contact Us',
        confidence: 'high' as const,
        candidates: [],
        needsClarification: false,
      },
    });
    const result = resolveConfigTextEdit({
      message: 'add my phone number 1234 1234123 123',
      siteConfigContent: config,
      pinnedSectionIndex: 0,
      selectedTargetContext: selectedTargetContext ?? undefined,
    });
    expect(result.kind).toBe('apply');
    if (result.kind === 'apply') {
      expect(result.fieldPath).toBe('contact.phone');
      expect(result.value).toBe('1234 1234123 123');
    }
  });

  it('Mode A accepts bare pinned copy without change-to phrasing', () => {
    const ctx = buildSelectedTargetContext({
      selectedTarget: contactSelectedTarget,
      siteConfigContent: contactSiteConfig,
      pageContent: '',
      catalog: buildSiteSectionCatalog(contactSiteConfig, ''),
      target: contactEditContext('').target,
    });
    const result = resolveConfigTextEdit({
      message: "We'd love to hear from you",
      siteConfigContent: contactSiteConfig,
      pinnedSectionIndex: 0,
      selectedTargetContext: ctx ?? undefined,
    });
    expect(result.kind).toBe('apply');
    if (result.kind === 'apply') {
      expect(result.fieldPath).toBe('sections[0].subtitle');
      expect(result.value).toBe("We'd love to hear from you");
    }
  });

  it('enumerateAllowlistedFields indexes contact and section fields', () => {
    const entries = enumerateAllowlistedFields(contactSiteConfig);
    expect(entries.some((e) => e.fieldPath === 'contact.email')).toBe(true);
    expect(entries.some((e) => e.fieldPath === 'sections[0].body')).toBe(true);
  });

  it('buildDeterministicPlan applies bare pinned contact copy to subtitle', () => {
    const plan = buildDeterministicPlan(contactEditContext("We'd love to hear from you"));
    expect(plan?.needsClarification).toBe(false);
    expect(plan?.steps[0]?.skill).toBe('update_config_field');
    expect(plan?.steps[0]?.params).toMatchObject({
      fieldPath: 'sections[0].subtitle',
      value: "We'd love to hear from you",
    });
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

  it('normalizeMisroutedCopyPlan rewrites misrouted section title to inner card subtitle', () => {
    const editContext = contactEditContext(
      'change contact information title of the card to "this is david"'
    );
    const rewritten = normalizeMisroutedCopyPlan(
      {
        planVersion: 'website-agent',
        needsClarification: false,
        steps: [
          {
            skill: 'update_section_copy',
            params: { sectionIndex: 0, field: 'title', value: 'this is david' },
          },
        ],
      },
      editContext
    );
    expect(rewritten.steps[0]?.skill).toBe('update_config_field');
    expect(rewritten.steps[0]?.params).toMatchObject({
      fieldPath: 'sections[0].subtitle',
      value: 'this is david',
    });
  });

  it('normalizeMisroutedCopyPlan rewrites misrouted update_config_field title path', () => {
    const editContext = contactEditContext(
      'change contact information title of the card to "this is david"'
    );
    const rewritten = normalizeMisroutedCopyPlan(
      {
        planVersion: 'website-agent',
        needsClarification: false,
        steps: [
          {
            skill: 'update_config_field',
            params: { fieldPath: 'sections[0].title', value: 'this is david' },
          },
        ],
      },
      editContext
    );
    expect(rewritten.steps[0]?.params).toMatchObject({
      fieldPath: 'sections[0].subtitle',
      value: 'this is david',
    });
  });

  it('explicit btn phrase overrides stale pinned subtitle fieldPath', () => {
    const config = `export const siteConfig = {
      businessName: "Demo Co",
      hero: { headline: "Hero", subheadline: "", primaryCta: "Get in Touch" },
      contact: { phone: "555", email: "a@b.c" },
      sections: [
        {
          type: "contact",
          title: "Get Started Today",
          subtitle: "this is david",
          body: "Reach out."
        }
      ]
    };`;
    const ctx = contactEditContext('change get in touch btn to hello click on this');
    ctx.siteModel.siteConfigContent = config;
    const pinnedSubtitle = {
      ...contactSelectedTarget,
      fieldPath: 'sections[0].subtitle',
    };
    ctx.selectedTarget = pinnedSubtitle;
    ctx.selectedTargetContext = buildSelectedTargetContext({
      selectedTarget: pinnedSubtitle,
      siteConfigContent: config,
      pageContent: '',
      catalog: buildSiteSectionCatalog(config, ''),
      target: ctx.target,
    }) ?? undefined;

    const result = resolveConfigTextEdit({
      message: 'change get in touch btn to hello click on this',
      siteConfigContent: config,
      pinnedSectionIndex: 0,
      selectedTargetContext: ctx.selectedTargetContext,
    });
    expect(result.kind).toBe('apply');
    if (result.kind === 'apply') {
      expect(result.fieldPath).toBe('hero.primaryCta');
      expect(result.value).toBe('hello click on this');
    }
  });

  it('element pin applies only pinned fieldPath for bare replacement value', () => {
    const config = `export const siteConfig = {
      businessName: "Demo Co",
      hero: { headline: "Hero", subheadline: "", primaryCta: "Get in Touch" },
      contact: { phone: "555-0000", email: "a@b.c" },
      sections: [
        {
          type: "contact",
          title: "Get Started Today",
          subtitle: "Contact Information",
          body: "Reach out."
        }
      ]
    };`;
    const pinnedPhone = {
      ...contactSelectedTarget,
      fieldPath: 'contact.phone',
      elementKind: 'button',
      elementLabel: 'Phone button',
      pinScope: 'element' as const,
    };
    const selectedTargetContext = buildSelectedTargetContext({
      selectedTarget: pinnedPhone,
      siteConfigContent: config,
      pageContent: '',
      catalog: buildSiteSectionCatalog(config, ''),
      target: {
        kind: 'section' as const,
        sectionIndex: 0,
        sectionType: 'contact',
        title: 'Get Started Today',
        confidence: 'high' as const,
        candidates: [],
        needsClarification: false,
      },
    });

    expect(selectedTargetContext?.pinnedElementOnly).toBe(true);
    expect(selectedTargetContext?.allowedFieldPaths).toEqual(['contact.phone']);

    const result = resolveConfigTextEdit({
      message: 'change phone to 555-9999',
      siteConfigContent: config,
      pinnedSectionIndex: 0,
      selectedTargetContext: selectedTargetContext ?? undefined,
    });
    expect(result.kind).toBe('apply');
    if (result.kind === 'apply') {
      expect(result.fieldPath).toBe('contact.phone');
      expect(result.value).toBe('555-9999');
    }
  });
});
