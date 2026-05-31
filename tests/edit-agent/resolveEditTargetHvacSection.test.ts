import { describe, expect, it } from 'vitest';
import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';
import { resolveEditTargetSync } from '@/lib/project-workspace/edit-context/resolveEditTarget';
import {
  extractSectionTitleCandidates,
} from '@/lib/project-workspace/edit-shared/resolveSectionTarget';
import {
  buildSiteSectionCatalog,
  findSectionsContainingPhrase as findSectionsInCatalog,
  matchSectionFromMessage,
} from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import type { SiteModel } from '@/lib/project-workspace/site-model/types';

const SERVICES_TITLE = 'Everything Your HVAC Business Needs to Thrive';
const HERO_HEADLINE = 'Your HVAC Website Should Work as Hard as You Do';

const HVAC_MSG = `change color of the "${SERVICES_TITLE}" section to blue to gray gradient`;

const SITE_CONFIG = `
export const siteConfig = {
  businessName: "ServiceProMagic",
  hero: { headline: "${HERO_HEADLINE}", subheadline: "Convert leads" },
  sections: [
    { type: "services", title: "${SERVICES_TITLE}", body: "Full-service HVAC marketing.", items: [] },
    { type: "about", title: "Why ServiceProMagic?", body: "We help contractors grow.", items: [] }
  ]
};`;

const PAGE = `
function ServicesSection({ section }) {
  return <section>{section.title}</section>;
}
function AboutSection({ section }) {
  return <section>{section.title}</section>;
}
function SectionRenderer({ section }) {
  switch (section.type) {
    case "services": return <ServicesSection section={section} />;
    case "about": return <AboutSection section={section} />;
    default: return null;
  }
}
{siteConfig.sections.map((s) => <SectionRenderer section={s} />)}
`;

function siteModel(): SiteModel {
  const catalog = buildSiteSectionCatalog(SITE_CONFIG, PAGE);
  return {
    workspacePath: '/tmp/test',
    mode: 'gitlab',
    archetype: 'section-loop',
    siteConfigContent: SITE_CONFIG,
    pageContent: PAGE,
    structure: catalog.snapshot,
    parsedConfig: {
      businessName: 'ServiceProMagic',
      contact: {},
      sections: [
        { type: 'services', title: SERVICES_TITLE },
        { type: 'about', title: 'Why ServiceProMagic?' },
      ],
    },
  } as unknown as SiteModel;
}

describe('resolveEditTarget HVAC services section by quoted title', () => {
  const catalog = buildSiteSectionCatalog(SITE_CONFIG, PAGE);

  it('extracts the quoted section title from owner phrasing', () => {
    expect(extractSectionTitleCandidates(HVAC_MSG)).toContain(SERVICES_TITLE);
    expect(classifyEditWhat(HVAC_MSG)).toBe('style_background');
  });

  it('locates the phrase in the services section catalog entry', () => {
    const hits = findSectionsInCatalog(SERVICES_TITLE, catalog);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.index).toBe(0);
    expect(hits[0]?.type).toBe('services');
  });

  it('matchSectionFromMessage resolves quoted title to services index 0', () => {
    const match = matchSectionFromMessage(HVAC_MSG, catalog);
    expect(match?.confidence).toBe('high');
    expect(match?.sectionIndex).toBe(0);
    expect(match?.title).toBe(SERVICES_TITLE);
  });

  it('resolveEditTargetSync picks services section, not hero', () => {
    const target = resolveEditTargetSync(HVAC_MSG, siteModel(), catalog);
    expect(target.kind).toBe('section');
    expect(target.sectionIndex).toBe(0);
    expect(target.sectionType).toBe('services');
    expect(target.confidence).toBe('high');
    expect(target.needsClarification).toBe(false);
  });

  it('does not route to hero when hero headline differs from quoted section title', () => {
    const target = resolveEditTargetSync(HVAC_MSG, siteModel(), catalog);
    expect(target.kind).not.toBe('hero');
  });
});
