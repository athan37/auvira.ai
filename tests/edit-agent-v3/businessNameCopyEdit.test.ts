import { afterEach, describe, expect, it } from 'vitest';
import { EditPlanSchema } from '@/lib/project-workspace/planner/editPlan.schema';
import { normalizeEditPlanPayload } from '@/lib/project-workspace/planner/normalizeEditPlan';
import { executePlan } from '@/lib/project-workspace/edit-agent-v3/executePlan';
import { executeDomainTool, paramsForSkill } from '@/lib/project-workspace/tools/domain/registry';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';

describe('EditPlanSchema businessName targets', () => {
  it('accepts businessName target kind from planner output', () => {
    const raw = {
      needsClarification: false,
      intent: 'copy',
      targets: [
        { kind: 'businessName', field: 'businessName' },
        { kind: 'hero', field: 'headline' },
      ],
      steps: [
        {
          skill: 'update_business_name',
          params: { value: 'All-Star HVAC - Houston Premier Team' },
        },
        {
          skill: 'update_hero',
          params: { field: 'headline', value: 'All-Star HVAC - Houston Premier Team' },
        },
      ],
    };

    const parsed = EditPlanSchema.safeParse(normalizeEditPlanPayload(raw));
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it('normalizes business alias target kinds', () => {
    const raw = {
      needsClarification: false,
      steps: [{ skill: 'update_business_name', params: { value: 'Acme Co' } }],
      targets: [{ kind: 'business', field: 'businessName' }],
    };
    const normalized = normalizeEditPlanPayload(raw) as { targets?: Array<{ kind?: string }> };
    expect(normalized.targets?.[0]?.kind).toBe('businessName');
  });
});

describe('duplicate headline + business name copy edit', () => {
  let workspacePath: string;

  it('updates businessName and hero headline from V3 plan steps', async () => {
    const duplicateTitle = "Houston's HVAC All-Stars Are Here to Win Your Comfort";
    const newTitle = 'All-Star HVAC - Houston Premier Team';

    workspacePath = await createSyntheticWorkspace({
      site: {
        businessName: duplicateTitle,
        hero: { headline: duplicateTitle, subheadline: 'Comfort experts' },
        sections: [{ type: 'gallery', title: 'Our Products' }],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const ctxResult = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: newTitle,
      conversationHistory: [
        {
          role: 'user',
          content: `change this description "${duplicateTitle}" to hi this is david`,
        },
        {
          role: 'assistant',
          content:
            `The text '${duplicateTitle}' appears as business name and hero headline. Which to update?`,
        },
        { role: 'user', content: 'Both the business name and hero headline' },
        {
          role: 'assistant',
          content: 'What would you like the new business name and hero headline to be?',
        },
        { role: 'user', content: newTitle },
      ],
      infraBaselineReady: true,
    });

    const plan = EditPlanSchema.parse({
      planVersion: 'website-agent-v3',
      needsClarification: false,
      intent: 'copy',
      targets: [
        { kind: 'businessName', field: 'businessName' },
        { kind: 'hero', field: 'headline' },
      ],
      steps: [
        { skill: 'update_business_name', params: { value: newTitle } },
        { skill: 'update_hero', params: { field: 'headline', value: newTitle } },
      ],
    });

    const result = await executePlan(plan, ctxResult.context, {
      workspacePath,
      ownerMessage: newTitle,
      projectId: 'dup-copy-test',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.ok, result.error).toBe(true);

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfig).toContain(`"businessName": ${JSON.stringify(newTitle)}`);
    expect(siteConfig).toContain(`"headline": ${JSON.stringify(newTitle)}`);
  });

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = '';
    }
  });
});

describe('update_business_name domain tool', () => {
  it('paramsForSkill maps update_business_name to business scope', () => {
    const params = paramsForSkill(
      'update_business_name',
      { kind: 'businessName' },
      { value: 'New Biz Name' },
      {
        effectiveMessage: 'New Biz Name',
      } as never
    );
    expect(params).toEqual({
      scope: 'business',
      field: 'businessName',
      value: 'New Biz Name',
    });
  });

  it('writes businessName in siteConfig', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        businessName: 'Old Name',
        hero: { headline: 'Old Name' },
        sections: [{ type: 'services', title: 'Services' }],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    try {
      const ctxResult = await buildEditContext({
        workspacePath,
        mode: 'gitlab',
        ownerMessage: 'Rename business to New Name',
        infraBaselineReady: true,
      });

      const result = await executeDomainTool(
        'update_copy_field',
        {
          editContext: ctxResult.context,
          agentOptions: {
            workspacePath,
            ownerMessage: 'Rename business to New Name',
            projectId: 'test',
            mode: 'gitlab',
            infraBaselineReady: true,
          },
          changedFiles: [],
          beforeFiles: {},
          afterFiles: {},
        },
        { scope: 'business', field: 'businessName', value: 'New Name' }
      );

      expect(result.ok).toBe(true);
      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      expect(siteConfig).toContain('"businessName": "New Name"');
    } finally {
      await destroySyntheticWorkspace(workspacePath);
    }
  });
});
