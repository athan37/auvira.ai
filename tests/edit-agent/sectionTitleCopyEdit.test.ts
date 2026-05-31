import { afterEach, describe, expect, it } from 'vitest';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import { executePlan } from '@/lib/project-workspace/edit-agent/executePlan';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { resolveEditTarget } from '@/lib/project-workspace/edit-context/resolveEditTarget';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import {
  extractSectionTitleCandidates,
  parseSectionTitleCopyEdit,
} from '@/lib/project-workspace/edit-shared/resolveSectionTarget';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';

import type { SyntheticSiteSpec } from '../support/syntheticSiteWorkspace';

const OUR_PRODUCTS_SITE: SyntheticSiteSpec = {
  businessName: 'Copy Edit Test Site',
  sections: [
    { type: 'services', title: 'Our Products' },
    { type: 'testimonials', title: 'What Our Customers Say' },
    { type: 'contact', title: 'Get Started Today' },
  ],
};

const OWNER_MESSAGE = 'change Our Products section title to hello this is david 2';
const NEW_TITLE = 'hello this is david 2';

describe('section title copy edit intent', () => {
  it('parses named section title copy from owner message', () => {
    expect(parseSectionTitleCopyEdit(OWNER_MESSAGE)).toEqual({
      sectionTitleHint: 'Our Products',
      field: 'title',
      value: NEW_TITLE,
    });
    expect(extractSectionTitleCandidates(OWNER_MESSAGE)).toContain('Our Products');
  });

  it('parses section title of {name} phrasing', () => {
    expect(
      parseSectionTitleCopyEdit('update section title of Our Products to hello this is david 2')
    ).toEqual({
      sectionTitleHint: 'Our Products',
      field: 'title',
      value: NEW_TITLE,
    });
  });
});

describe('section title copy edit (Our Products)', () => {
  let workspacePath: string;

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = '';
    }
  });

  it('resolves Our Products section and builds deterministic copy plan', async () => {
    workspacePath = await createSyntheticWorkspace({
      site: OUR_PRODUCTS_SITE,
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const page = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
    const catalog = buildSiteSectionCatalog(siteConfig, page);

    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      infraBaselineReady: true,
    });

    expect(built.needsClarification).toBe(false);
    expect(built.context.target.sectionIndex).toBe(0);
    expect(built.context.target.title).toBe('Our Products');

    const target = resolveEditTarget(OWNER_MESSAGE, built.context.siteModel, catalog);
    expect(target.sectionIndex).toBe(0);
    expect(target.needsClarification).toBe(false);

    const deterministic = buildDeterministicPlan(built.context);
    expect(deterministic?.needsClarification).not.toBe(true);
    expect(deterministic?.steps[0]?.skill).toBe('update_section_copy');
    expect(deterministic?.steps[0]?.params?.value).toBe(NEW_TITLE);
    expect(deterministic?.steps[0]?.params?.sectionIndex).toBe(0);

    const planResult = await planEdit({
      editContext: built.context,
      userPrompt: OWNER_MESSAGE,
      deterministicOnly: true,
    });
    expect(planResult.ok).toBe(true);
    expect(planResult.plan?.steps[0]?.skill).toBe('update_section_copy');
  });

  it('does not trigger duplicate business/hero clarification when names match', async () => {
    workspacePath = await createSyntheticWorkspace({
      site: {
        businessName: 'Same Title Co',
        hero: { headline: 'Same Title Co' },
        sections: OUR_PRODUCTS_SITE.sections,
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      infraBaselineReady: true,
    });

    expect(built.needsClarification).toBe(false);
    expect(built.context.target.sectionIndex).toBe(0);
    expect(built.context.target.title).toBe('Our Products');
  });

  it('updates section title even after prior both business/hero choice in history', async () => {
    workspacePath = await createSyntheticWorkspace({
      site: {
        businessName: 'Both the business name and hero headline',
        hero: { headline: 'Both the business name and hero headline' },
        sections: OUR_PRODUCTS_SITE.sections,
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const conversationHistory = [
      {
        role: 'assistant' as const,
        content:
          'The same text appears as your business name and hero headline. Which should I update?',
      },
      {
        role: 'user' as const,
        content: 'Both the business name and hero headline',
      },
      {
        role: 'assistant' as const,
        content: 'What should the new text be for both the business name and hero headline?',
      },
    ];

    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      conversationHistory,
      infraBaselineReady: true,
    });

    expect(built.needsClarification).toBe(false);
    expect(built.context.target.sectionIndex).toBe(0);
    expect(built.context.target.title).toBe('Our Products');

    const plan = buildDeterministicPlan(built.context);
    expect(plan?.needsClarification).not.toBe(true);
    expect(plan?.steps[0]?.skill).toBe('update_section_copy');
    expect(plan?.steps[0]?.params?.field).toBe('title');
    expect(plan?.steps[0]?.params?.value).toBe(NEW_TITLE);
    expect(plan?.steps[0]?.params?.sectionIndex).toBe(0);

    const result = await executePlan(plan!, built.context, {
      workspacePath,
      ownerMessage: OWNER_MESSAGE,
      projectId: 'section-title-after-both-choice',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.ok, result.error).toBe(true);

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfig).toContain(`"title": ${JSON.stringify(NEW_TITLE)}`);
    expect(siteConfig).toContain('"businessName": "Both the business name and hero headline"');
    expect(siteConfig).toContain('"headline": "Both the business name and hero headline"');
  });

  it('executes end-to-end and updates siteConfig section title', async () => {
    workspacePath = await createSyntheticWorkspace({
      site: OUR_PRODUCTS_SITE,
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: OWNER_MESSAGE,
      infraBaselineReady: true,
    });

    const plan = buildDeterministicPlan(built.context);
    expect(plan).not.toBeNull();

    const result = await executePlan(plan!, built.context, {
      workspacePath,
      ownerMessage: OWNER_MESSAGE,
      projectId: 'section-title-copy-edit',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.ok, result.error).toBe(true);

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfig).toContain(`"title": ${JSON.stringify(NEW_TITLE)}`);
    expect(siteConfig).not.toContain('"title": "Our Products"');
  });
});
