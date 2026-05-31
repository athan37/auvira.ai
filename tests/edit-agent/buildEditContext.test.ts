import { describe, it, expect } from 'vitest';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { resolveEditTarget } from '@/lib/project-workspace/edit-context/resolveEditTarget';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import {
  buildSyntheticSiteConfigSource,
  createSyntheticWorkspace,
} from '../support/syntheticSiteWorkspace';
import type { SiteModel } from '@/lib/project-workspace/site-model/types';

function mockSiteModel(partial: Partial<SiteModel> & Pick<SiteModel, 'siteConfigContent' | 'pageContent'>): SiteModel {
  return {
    workspacePath: '/tmp/test',
    mode: 'gitlab',
    archetype: 'section_loop',
    siteConfigPath: null,
    pagePath: null,
    indexHtmlPath: null,
    siteJsonPath: null,
    stylesPath: null,
    indexHtmlContent: null,
    siteJsonContent: null,
    parsedConfig: null,
    structure: null,
    errors: [],
    ...partial,
  };
}

describe('buildEditContext', () => {
  it('builds EditContext from synthetic wired workspace', async () => {
    const siteConfig = buildSyntheticSiteConfigSource({
      sections: [
        { type: 'services', title: 'Everything You Need to Grow Your Business' },
        { type: 'contact', title: 'Get Started Today' },
      ],
    });

    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Everything You Need to Grow Your Business' },
          { type: 'contact', title: 'Get Started Today' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const result = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage:
        'change this section background to color gradient "Everything You Need to Grow Your Business"',
      infraBaselineReady: true,
    });

    expect(result.needsClarification).toBe(false);
    expect(result.context.sections.length).toBe(2);
    expect(result.context.target.sectionIndex).toBe(0);
    expect(result.context.target.title).toBe('Everything You Need to Grow Your Business');
    expect(result.context.allowedWritePaths).toContain('src/lib/siteConfig.ts');
    expect(result.context.verificationContract.checks.length).toBeGreaterThan(0);
    void siteConfig;
  });
});

describe('resolveEditTarget', () => {
  it('quoted title wins over deictic this section', () => {
    const siteConfig = buildSyntheticSiteConfigSource({
      sections: [
        { type: 'services', title: 'Everything You Need to Grow Your Business' },
        { type: 'contact', title: 'Get Started Today' },
      ],
    });
    const page = `export default function Page() { return null; }`;
    const catalog = buildSiteSectionCatalog(siteConfig, page);

    const target = resolveEditTarget(
      'change this section background to color gradient "Everything You Need to Grow Your Business"',
      mockSiteModel({ siteConfigContent: siteConfig, pageContent: page }),
      catalog
    );

    expect(target.sectionIndex).toBe(0);
    expect(target.confidence).toBe('high');
    expect(target.needsClarification).toBe(false);
  });

  it('returns clarification for deictic-only style request', () => {
    const siteConfig = buildSyntheticSiteConfigSource({
      sections: [
        { type: 'services', title: 'Services' },
        { type: 'contact', title: 'Contact' },
      ],
    });
    const page = `export default function Page() { return null; }`;
    const catalog = buildSiteSectionCatalog(siteConfig, page);

    const target = resolveEditTarget(
      'change this section background to red',
      mockSiteModel({ siteConfigContent: siteConfig, pageContent: page }),
      catalog
    );

    expect(target.needsClarification).toBe(true);
    expect(target.clarificationMessage).toMatch(/which section/i);
  });

  it('resolves last section via ordinal', () => {
    const siteConfig = buildSyntheticSiteConfigSource({
      sections: [
        { type: 'services', title: 'Services' },
        { type: 'contact', title: 'Get Started Today' },
      ],
    });
    const page = `export default function Page() { return null; }`;
    const catalog = buildSiteSectionCatalog(siteConfig, page);

    const target = resolveEditTarget(
      'change background color of the last section to black',
      mockSiteModel({ siteConfigContent: siteConfig, pageContent: page }),
      catalog
    );

    expect(target.sectionIndex).toBe(1);
    expect(target.title).toBe('Get Started Today');
  });

  it('clarifies when explicit section title does not exist (single-word trap)', () => {
    const siteConfig = buildSyntheticSiteConfigSource({
      sections: [
        { type: 'services', title: 'Everything You Need to Grow Your Business' },
        { type: 'contact', title: 'Get Started Today' },
      ],
    });
    const page = `export default function Page() { return null; }`;
    const catalog = buildSiteSectionCatalog(siteConfig, page);

    const target = resolveEditTarget(
      'change background of section titled business to yellow',
      mockSiteModel({ siteConfigContent: siteConfig, pageContent: page }),
      catalog
    );

    expect(target.needsClarification).toBe(true);
    expect(target.sectionIndex).toBeUndefined();
    expect(target.clarificationMessage).toMatch(/section titled "business"/i);
  });
});
