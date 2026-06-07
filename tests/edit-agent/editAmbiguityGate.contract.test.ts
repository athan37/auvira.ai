import { describe, expect, it } from 'vitest';
import {
  assessEditAmbiguity,
  formatAmbiguityClarification,
} from '@/lib/project-workspace/edit-context/assessEditAmbiguity';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';
import { resolveEditTarget } from '@/lib/project-workspace/edit-context/resolveEditTarget';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import { computeWorkspaceHashes } from '@/lib/project-workspace/workspaceEditShared';
import {
  isBackgroundColorEditRequest,
  isSectionScopedSolidColorRequest,
} from '@/lib/project-workspace/verifyPreviewHints';
import {
  buildSyntheticSiteConfigSource,
  createSyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';
import type { SiteModel } from '@/lib/project-workspace/site-model/types';

const SECTIONS = [
  { type: 'services', title: 'Everything You Need to Grow Your Business' },
  { type: 'testimonials', title: 'What Our Clients Say' },
  { type: 'contact', title: 'Get Started Today' },
] as const;

function mockSiteModel(
  partial: Partial<SiteModel> & Pick<SiteModel, 'siteConfigContent' | 'pageContent'>
): SiteModel {
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

async function createAmbiguityWorkspace() {
  return createSyntheticWorkspace({
    site: { sections: [...SECTIONS] },
    pageMode: 'wired',
    tailwind: 'canonical',
  });
}

async function runAgentMessage(workspacePath: string, ownerMessage: string) {
  const before = await computeWorkspaceHashes(workspacePath);
  const result = await runWebsiteEditAgent({
    workspacePath,
    ownerMessage,
    projectId: 'edit-ambiguity-gate-contract',
    mode: 'gitlab',
    infraBaselineReady: true,
  });
  const after = await computeWorkspaceHashes(workspacePath);
  const changed =
    Object.keys(after).filter((path) => before[path] !== after[path]).length > 0;
  return { result, changed };
}

describe('edit ambiguity gate contract', () => {
  describe('apply — smart default background', () => {
    const ownerMessage = 'change first section to red';

    it('classifies ordinal section + color as background style', () => {
      expect(isSectionScopedSolidColorRequest(ownerMessage)).toBe(true);
      expect(isBackgroundColorEditRequest(ownerMessage)).toBe(true);
      expect(classifyEditWhat(ownerMessage)).toBe('style_background');
    });

    it('resolves first section to sections[0]', () => {
      const siteConfig = buildSyntheticSiteConfigSource({ sections: [...SECTIONS] });
      const page = `export default function Page() { return null; }`;
      const catalog = buildSiteSectionCatalog(siteConfig, page);
      const target = resolveEditTarget(ownerMessage, mockSiteModel({ siteConfigContent: siteConfig, pageContent: page }), catalog);
      expect(target.needsClarification).toBe(false);
      expect(target.sectionIndex).toBe(0);
      expect(target.confidence).toBe('high');
    });

    it('passes pre-plan gate and builds deterministic plan', async () => {
      const workspacePath = await createAmbiguityWorkspace();
      const built = await buildEditContext({
        workspacePath,
        mode: 'gitlab',
        ownerMessage,
        infraBaselineReady: true,
      });
      expect(built.needsClarification).toBe(false);
      expect(built.context.target.sectionIndex).toBe(0);

      const plan = buildDeterministicPlan(built.context);
      expect(plan?.needsClarification).toBe(false);
      expect(plan?.steps.some((step) => step.skill === 'update_section_style')).toBe(true);
    });

    it('applies red background end-to-end', async () => {
      const workspacePath = await createAmbiguityWorkspace();
      const { result, changed } = await runAgentMessage(workspacePath, ownerMessage);

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
      expect(changed).toBe(true);
      expect(result.changedFiles?.length ?? 0).toBeGreaterThan(0);
      expect(result.ownerMessage?.toLowerCase()).not.toContain('updated the page content.');

      const siteConfigAfter = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const servicesAnchor = siteConfigAfter.indexOf('Everything You Need to Grow Your Business');
      expect(servicesAnchor).toBeGreaterThan(-1);
      expect(siteConfigAfter.slice(servicesAnchor, servicesAnchor + 500).toLowerCase()).toMatch(/red|bg-red/);
    });
  });

  describe('apply — explicit background wording', () => {
    it('applies when background is named explicitly', async () => {
      const workspacePath = await createAmbiguityWorkspace();
      const { result, changed } = await runAgentMessage(
        workspacePath,
        'change background of first section to red'
      );
      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.ownerMessage).toBe(true);
      expect(changed).toBe(true);
    });
  });

  describe('clarify — ambiguous targets and scope', () => {
    const blockedCases = [
      {
        message: 'change section to red',
        label: 'no ordinal section',
      },
      {
        message: 'change this section to red',
        label: 'deictic without pin',
      },
      {
        message: 'change first section',
        label: 'no value',
      },
      {
        message: 'change testimonials card to red',
        label: 'card scope ambiguous',
      },
    ] as const;

    it.each(blockedCases)('blocks: $label', async ({ message }) => {
      const workspacePath = await createAmbiguityWorkspace();
      const { result, changed } = await runAgentMessage(workspacePath, message);

      expect(result.needsClarification, result.ownerMessage).toBe(true);
      expect(result.ok).toBe(false);
      expect(changed).toBe(false);
      expect(result.changedFiles ?? []).toHaveLength(0);
      expect(result.ownerMessage?.toLowerCase() ?? '').not.toContain('updated the page content.');
      expect(result.guidanceHints?.length ?? 0).toBeGreaterThan(0);
    });
  });
});

describe('assessEditAmbiguity unit', () => {
  it('formats structured reason bullets', () => {
    const formatted = formatAmbiguityClarification(['missing_target', 'missing_value']);
    expect(formatted.message).toContain("What's unclear:");
    expect(formatted.message).toContain('Pin a section from the preview');
    expect(formatted.message).toContain('exact new value');
  });

  it('returns missing_target for unresolved site-level style', async () => {
    const workspacePath = await createAmbiguityWorkspace();
    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: 'change section to red',
      infraBaselineReady: true,
    });
    const assessment = assessEditAmbiguity(built.context);
    expect(assessment.blocked).toBe(true);
    expect(assessment.reasons).toContain('missing_target');
  });

  it('allows smart-default path for ordinal section + color', async () => {
    const workspacePath = await createAmbiguityWorkspace();
    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: 'change first section to red',
      infraBaselineReady: true,
    });
    const assessment = assessEditAmbiguity(built.context);
    expect(assessment.blocked).toBe(false);
    expect(assessment.reasons).toHaveLength(0);
  });
});
