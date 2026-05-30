import { describe, it, expect } from 'vitest';
import { runRestrictedCustomCodeEdit } from '@/lib/project-workspace/edit-agent-v3/restrictedFallback';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import type { SiteSectionCatalog } from '@/lib/project-workspace/website-edit-agent/siteSectionCatalog';

function mockEditContext(): EditContext {
  return {
    workspacePath: '/tmp/restricted-test',
    mode: 'gitlab',
    ownerMessage: 'custom edit',
    effectiveMessage: 'custom edit',
    siteModel: {
      workspacePath: '/tmp/restricted-test',
      mode: 'gitlab',
      archetype: 'section_loop',
      siteConfigPath: null,
      pagePath: null,
      indexHtmlPath: null,
      siteJsonPath: null,
      stylesPath: null,
      siteConfigContent: null,
      pageContent: null,
      indexHtmlContent: null,
      siteJsonContent: null,
      parsedConfig: null,
      structure: null,
      errors: [],
    },
    sectionCatalog: {
      sections: [],
      textBlock: '',
      numberedReplies: [],
      snapshot: {
        sections: [],
        structureMap: '',
        sectionTypesInConfig: [],
        sectionTypesInPage: [],
        rendersFromSiteConfig: true,
        hasGalleryRenderer: false,
        hasGenericRenderer: false,
        defaultRendersNull: false,
        heroHasImageSlot: false,
      },
    } satisfies SiteSectionCatalog,
    sections: [],
    target: {
      kind: 'site',
      confidence: 'medium',
      candidates: [],
      needsClarification: false,
    },
    selectedSnippets: [],
    allowedWritePaths: ['src/lib/siteConfig.ts'],
    riskFlags: {
      level: 'low',
      compoundIntent: false,
      lowConfidenceTarget: false,
      infraNotReady: false,
      legacyArchetype: false,
      reasons: [],
    },
    verificationContract: { checks: [{ kind: 'generic' }] },
    infraBaselineReady: true,
  };
}

describe('restrictedFallback', () => {
  it('exports runRestrictedCustomCodeEdit', () => {
    expect(typeof runRestrictedCustomCodeEdit).toBe('function');
  });

  it('allowedWritePaths restricts custom edits', () => {
    const ctx = mockEditContext();
    expect(ctx.allowedWritePaths).toEqual(['src/lib/siteConfig.ts']);
  });
});
