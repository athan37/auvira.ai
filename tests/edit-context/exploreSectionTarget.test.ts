import { describe, expect, it } from 'vitest';
import { exploreSectionTargetDeterministic } from '@/lib/project-workspace/edit-context/exploreSectionTarget';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

const SITE_CONFIG = `export const siteConfig = {
  businessName: 'Demo',
  hero: { headline: 'Hero', subheadline: '' },
  contact: { phone: '555', email: 'a@b.co' },
  sections: [
    {
      type: 'contact',
      title: 'Get Started Today',
      body: 'Ready to get started?',
      subtitle: '',
      analyticsId: 'c1',
    },
  ],
};`;

function minimalContext(overrides: Partial<EditContext> = {}): EditContext {
  return {
    workspacePath: '/tmp/ws',
    mode: 'clone',
    ownerMessage: 'change contact information to hello david',
    effectiveMessage:
      'change contact information to hello david (UI-selected section: Get Started Today)',
    siteModel: { workspacePath: '/tmp/ws', mode: 'clone', siteConfigContent: SITE_CONFIG },
    sectionCatalog: { sections: [] },
    sections: [{ index: 0, type: 'contact', title: 'Get Started Today' }],
    target: {
      kind: 'section',
      sectionIndex: 0,
      sectionType: 'contact',
      title: 'Get Started Today',
      confidence: 'high',
      candidates: [],
      needsClarification: false,
    },
    selectedSnippets: [],
    allowedWritePaths: [],
    riskFlags: { level: 'low', compoundIntent: false, lowConfidenceTarget: false, infraNotReady: false, legacyArchetype: false, reasons: [] },
    verificationContract: { checks: [] },
    infraBaselineReady: true,
    selectedTarget: {
      kind: 'section',
      sectionIndex: 0,
      sectionType: 'contact',
      sectionTitle: 'Get Started Today',
      sectionId: 'c1',
    },
    ...overrides,
  } as EditContext;
}

describe('exploreSectionTargetDeterministic', () => {
  it('routes contact information phrase to sections[0].subtitle', () => {
    const result = exploreSectionTargetDeterministic(minimalContext());
    expect(result.kind).toBe('apply');
    if (result.kind === 'apply') {
      expect(result.fieldPath).toBe('sections[0].subtitle');
      expect(result.value).toBe('hello david');
    }
  });

  it('respects UI-pinned element fieldPath', () => {
    const result = exploreSectionTargetDeterministic(
      minimalContext({
        effectiveMessage:
          'change contact information to pinned value (UI-selected section: Get Started Today)',
        ownerMessage: 'change contact information to pinned value',
        selectedTarget: {
          kind: 'section',
          sectionIndex: 0,
          sectionType: 'contact',
          fieldPath: 'sections[0].subtitle',
          elementKind: 'heading',
          elementLabel: 'Contact Information',
        },
      })
    );
    expect(result.kind).toBe('apply');
    if (result.kind === 'apply') {
      expect(result.fieldPath).toBe('sections[0].subtitle');
      expect(result.value).toBe('pinned value');
    }
  });

  it('routes get in touch btn phrase to hero.primaryCta', () => {
    const configWithCta = SITE_CONFIG.replace(
      "hero: { headline: 'Hero', subheadline: '' }",
      "hero: { headline: 'Hero', subheadline: '', primaryCta: 'Get in Touch' }"
    );
    const result = exploreSectionTargetDeterministic(
      minimalContext({
        effectiveMessage:
          'change get in touch btn to Contact Us (UI-selected section: Get Started Today)',
        ownerMessage: 'change get in touch btn to Contact Us',
        siteModel: { workspacePath: '/tmp/ws', mode: 'gitlab', siteConfigContent: configWithCta },
      })
    );
    expect(result.kind).toBe('apply');
    if (result.kind === 'apply') {
      expect(result.fieldPath).toBe('hero.primaryCta');
      expect(result.value).toBe('Contact Us');
    }
  });
});
