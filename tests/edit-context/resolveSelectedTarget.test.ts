import { describe, expect, it } from 'vitest';
import { resolveSelectedTarget } from '@/lib/project-workspace/edit-context/resolveSelectedTarget';
import { resolveEditTargetSync } from '@/lib/project-workspace/edit-context/resolveEditTarget';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import type { SiteModel } from '@/lib/project-workspace/site-model/types';

const siteConfig = `export const siteConfig = {
  sections: [
    { "analyticsId": "section_services_services_1", "type": "services", "title": "Services", "items": [] },
    { "analyticsId": "section_contact_contact_2", "type": "contact", "title": "Contact", "items": [] }
  ]
};`;

const catalog = buildSiteSectionCatalog(siteConfig, '');

describe('resolveSelectedTarget', () => {
  it('resolves section by analyticsId', () => {
    const target = resolveSelectedTarget(
      {
        kind: 'section',
        sectionId: 'section_contact_contact_2',
        sectionIndex: 1,
        sectionType: 'contact',
        sectionTitle: 'Contact',
      },
      catalog,
      siteConfig
    );
    expect(target?.kind).toBe('section');
    expect(target?.sectionIndex).toBe(1);
    expect(target?.needsClarification).toBe(false);
  });

  it('resolves hero selection', () => {
    const target = resolveSelectedTarget({ kind: 'hero', sectionId: 'hero' }, catalog, siteConfig);
    expect(target?.kind).toBe('hero');
    expect(target?.needsClarification).toBe(false);
  });

  it('returns clarification for stale ID', () => {
    const target = resolveSelectedTarget(
      { kind: 'section', sectionId: 'section_missing_99', sectionIndex: 0, sectionType: 'faq' },
      catalog,
      siteConfig
    );
    expect(target?.needsClarification).toBe(true);
  });

  it('returns null when no selectedTarget', () => {
    expect(resolveSelectedTarget(undefined, catalog, siteConfig)).toBeNull();
  });

  it('selectedTarget beats editFocusStack in resolveEditTargetSync', () => {
    const siteModel = {
      siteConfigContent: siteConfig,
      pageContent: '',
      archetype: 'section-loop',
    } as unknown as SiteModel;
    const focusStack = {
      items: [
        {
          kind: 'section_style' as const,
          sectionIndex: 0,
          sectionTitle: 'Services',
          at: new Date().toISOString(),
        },
      ],
    };
    const target = resolveEditTargetSync(
      'make it black',
      siteModel,
      catalog,
      [],
      focusStack,
      {
        kind: 'section',
        sectionId: 'section_contact_contact_2',
        sectionIndex: 1,
        sectionType: 'contact',
        sectionTitle: 'Contact',
      }
    );
    expect(target.sectionIndex).toBe(1);
    expect(target.needsClarification).toBe(false);
  });
});
