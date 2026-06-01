import { describe, expect, it } from 'vitest';
import { buildPlanEditUserPrompt } from '@/lib/project-workspace/planner/planEditPrompt';
import {
  buildSelectedTargetContext,
  formatSelectedTargetContextBlock,
} from '@/lib/project-workspace/edit-context/selectedTargetContext';
import type { EditContext, EditTarget } from '@/lib/project-workspace/edit-context/types';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';

const servicesSiteConfig = `export const siteConfig = {
  businessName: "Acme HVAC",
  hero: { headline: "Welcome", subheadline: "We cool homes", tagline: "Fast service" },
  sections: [
    {
      type: "services",
      title: "Our Services",
      items: [
        { title: "AC Repair", description: "Emergency cooling repair" },
        { title: "Heating", description: "Furnace tune-ups" }
      ]
    }
  ]
};`;

const bodyOnlySiteConfig = `export const siteConfig = {
  businessName: "Acme",
  sections: [
    { type: "about", body: "We have served the community since 1990." }
  ]
};`;

const heroTarget = {
  kind: 'hero' as const,
  sectionId: 'hero',
  sectionType: 'hero',
  sectionTitle: 'Hero',
};

const servicesTarget = {
  kind: 'section' as const,
  sectionId: 'section_services_1',
  sectionIndex: 0,
  sectionType: 'services',
  sectionTitle: 'Our Services',
};

function mockTarget(sectionIndex?: number): EditTarget {
  if (sectionIndex == null) {
    return {
      kind: 'hero',
      confidence: 'high',
      candidates: [],
      needsClarification: false,
    };
  }
  return {
    kind: 'section',
    sectionIndex,
    sectionType: 'services',
    title: 'Our Services',
    confidence: 'high',
    candidates: [],
    needsClarification: false,
  };
}

describe('buildSelectedTargetContext', () => {
  it('builds hero editable fields', () => {
    const catalog = buildSiteSectionCatalog(servicesSiteConfig, '');
    const ctx = buildSelectedTargetContext({
      selectedTarget: heroTarget,
      siteConfigContent: servicesSiteConfig,
      pageContent: '',
      catalog,
      target: mockTarget(),
    });
    expect(ctx?.resolved.kind).toBe('hero');
    expect(ctx?.editableFields.map((f) => f.fieldPath)).toEqual([
      'hero.headline',
      'hero.subheadline',
      'hero.tagline',
    ]);
    expect(ctx?.recommendedDefaultField?.fieldPath).toBe('hero.headline');
  });

  it('builds services section with title, body, and item fields', () => {
    const catalog = buildSiteSectionCatalog(servicesSiteConfig, '');
    const ctx = buildSelectedTargetContext({
      selectedTarget: servicesTarget,
      siteConfigContent: servicesSiteConfig,
      pageContent: '',
      catalog,
      target: mockTarget(0),
    });
    expect(ctx?.section?.title).toBe('Our Services');
    expect(ctx?.section?.items).toHaveLength(2);
    const paths = ctx?.editableFields.map((f) => f.fieldPath) ?? [];
    expect(paths).toContain('sections[0].title');
    expect(paths).toContain('sections[0].items[0].title');
    expect(paths).toContain('sections[0].items[0].description');
    expect(ctx?.recommendedDefaultField?.fieldPath).toBe('sections[0].title');
  });

  it('includes body-only section text fields when title is missing', () => {
    const catalog = buildSiteSectionCatalog(bodyOnlySiteConfig, '');
    const ctx = buildSelectedTargetContext({
      selectedTarget: {
        kind: 'section',
        sectionIndex: 0,
        sectionType: 'about',
        sectionId: 'section_about_1',
      },
      siteConfigContent: bodyOnlySiteConfig,
      pageContent: '',
      catalog,
      target: {
        kind: 'section',
        sectionIndex: 0,
        sectionType: 'about',
        title: 'section 1',
        confidence: 'high',
        candidates: [],
        needsClarification: false,
      },
    });
    const paths = ctx?.editableFields.map((f) => f.fieldPath) ?? [];
    expect(paths).toContain('sections[0].body');
    expect(ctx?.recommendedDefaultField?.fieldPath).toBe('sections[0].body');
  });
});

describe('formatSelectedTargetContextBlock', () => {
  it('renders EDITABLE FIELDS and pin rules', () => {
    const catalog = buildSiteSectionCatalog(servicesSiteConfig, '');
    const ctx = buildSelectedTargetContext({
      selectedTarget: servicesTarget,
      siteConfigContent: servicesSiteConfig,
      pageContent: '',
      catalog,
      target: mockTarget(0),
    });
    expect(ctx).toBeTruthy();
    const block = formatSelectedTargetContextBlock(ctx!);
    expect(block).toContain('UI-SELECTED TARGET:');
    expect(block).toContain('EDITABLE FIELDS:');
    expect(block).toContain('sections[0].title');
    expect(block).toContain('RULES:');
  });
});

describe('planEditPrompt selected target block', () => {
  it('includes structured context when selectedTargetContext is present', () => {
    const catalog = buildSiteSectionCatalog(servicesSiteConfig, '');
    const selectedTargetContext = buildSelectedTargetContext({
      selectedTarget: servicesTarget,
      siteConfigContent: servicesSiteConfig,
      pageContent: '',
      catalog,
      target: mockTarget(0),
    });
    const editContext = {
      ownerMessage: 'change the title to "Hi"',
      effectiveMessage: 'change the title to "Hi"',
      siteModel: { parsedConfig: { businessName: 'Acme' }, archetype: 'gitlab-next', siteConfigContent: servicesSiteConfig },
      target: mockTarget(0),
      sectionCatalog: catalog,
      sections: [{ index: 0, type: 'services', title: 'Our Services' }],
      riskFlags: { level: 'low', reasons: [] },
      verificationContract: { checks: [] },
      selectedSnippets: [],
      selectedTargetContext,
    } as unknown as EditContext;

    const prompt = buildPlanEditUserPrompt(editContext, 'change the title to "Hi"');
    expect(prompt).toContain('EDITABLE FIELDS:');
    expect(prompt).toContain('sections[0].title');
  });
});
