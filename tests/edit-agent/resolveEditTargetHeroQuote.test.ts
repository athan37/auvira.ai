import { describe, expect, it } from 'vitest';
import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';
import { resolveEditTargetSync } from '@/lib/project-workspace/edit-context/resolveEditTarget';
import {
  extractSectionTitleCandidates,
} from '@/lib/project-workspace/edit-shared/resolveSectionTarget';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import type { SiteModel } from '@/lib/project-workspace/site-model/types';

const HERO_MSG =
  'change color of the "Your HVAC Website Should Work as Hard as You Do" section\'s background from red to green color gradient';

const SITE_CONFIG_SNIPPET = `
export const siteConfig = {
  businessName: "Your HVAC Website Should Work as Hard as You Do",
  hero: { headline: "Your HVAC Website Should Work as Hard as You Do", subheadline: "Convert leads" },
  sections: [
    { type: "services", title: "Everything Your HVAC Business Needs to Thrive", body: "x", items: [] }
  ]
};`;

function siteModel(): SiteModel {
  return {
    workspacePath: '/tmp/test',
    mode: 'gitlab',
    archetype: 'section-loop',
    siteConfigContent: SITE_CONFIG_SNIPPET,
    pageContent: '',
    parsedConfig: {
      businessName: 'Your HVAC Website Should Work as Hard as You Do',
      contact: {},
      sections: [{ type: 'services', title: 'Everything Your HVAC Business Needs to Thrive' }],
    },
  } as unknown as SiteModel;
}

describe('resolveEditTarget hero headline quote', () => {
  it('routes style edit quoting hero headline to hero target', () => {
    const catalog = buildSiteSectionCatalog(SITE_CONFIG_SNIPPET, '');
    expect(classifyEditWhat(HERO_MSG)).toBe('style_background');
    expect(extractSectionTitleCandidates(HERO_MSG)).toContain(
      'Your HVAC Website Should Work as Hard as You Do'
    );
    const target = resolveEditTargetSync(HERO_MSG, siteModel(), catalog);

    expect(target.kind).toBe('hero');
    expect(target.confidence).toBe('high');
    expect(target.needsClarification).toBe(false);
  });
});
