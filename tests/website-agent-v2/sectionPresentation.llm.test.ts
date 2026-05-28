/**
 * Live LLM integration tests for section presentation tokens.
 *
 * Run: npm run test:llm:presentation (MINIMAX_API_KEY in .env)
 */
import '../llmTestGate';
import { afterEach, describe, expect, it } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import { runWebsiteEditAgent } from '@/lib/project-workspace/website-edit-agent';
import { runWebsiteEditAgentV2 } from '@/lib/project-workspace/website-edit-agent-v2';
import { runWebsiteEdit } from '@/lib/project-workspace/websiteEditRunner';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { getSiteModel } from '@/lib/project-workspace/site-model/getSiteModel';
import { llmDescribe, planWithLiveLlm } from './llmIntegrationHarness';
import {
  assertNoStyleSubtitleHack,
  assertPlannerSectionStyle,
  assertSiteConfigPresentationField,
  assertSiteWideThemeNotSectionPresentation,
  assertV2EditSucceededForPresentation,
  assertV2PlannerSectionStyle,
  findV2StyleStep,
} from './sectionPresentationLlmAssertions';
import {
  cleanupPresentationWorkspace,
  createPresentationTestWorkspace,
  readWorkspacePage,
  readWorkspaceSiteConfig,
} from './presentationWorkspace';

type PlannerCase = {
  name: string;
  message: string;
  color?: string;
  sectionIndex?: number;
  expectClarify?: boolean;
  forbidSectionStyle?: boolean;
  expectThemeSkill?: boolean;
};

type E2eCase = {
  name: string;
  message: string;
  color?: string;
  field?: 'backgroundClass' | 'cardClass';
  expectClarify?: boolean;
  siteWide?: boolean;
};

const PLANNER_CASES: PlannerCase[] = [
  {
    name: 'gallery Hello section → yellow background',
    message: 'Change the Hello gallery section background to yellow',
    color: 'yellow',
    sectionIndex: 2,
  },
  {
    name: 'About Us section → blue background',
    message: 'Change the About Us section background to blue',
    color: 'blue',
    sectionIndex: 1,
  },
  {
    name: 'testimonials cards → red',
    message:
      'Make the testimonial cards red in the What Our Customers Say section',
    color: 'red',
    sectionIndex: 3,
  },
  {
    name: 'first section → blue background',
    message: 'Change the background of the first section to blue',
    color: 'blue',
    sectionIndex: 0,
  },
  {
    name: 'site-wide green (not per-section presentation)',
    message: 'Change the entire site background to green',
    forbidSectionStyle: true,
    expectThemeSkill: true,
  },
  {
    name: 'ambiguous section target → clarify',
    message: 'Make that section yellow',
    expectClarify: true,
  },
];

const E2E_CASES: E2eCase[] = [
  {
    name: 'gallery Hello → yellow via V2 executor',
    message: 'Change the Hello gallery section background to yellow',
    color: 'yellow',
    field: 'backgroundClass',
  },
  {
    name: 'About Us → blue background',
    message: 'Change the About Us section background to blue',
    color: 'blue',
    field: 'backgroundClass',
  },
  {
    name: 'testimonials cards → red cardClass',
    message: 'Make the cards red in the What Our Customers Say testimonials section',
    color: 'red',
    field: 'cardClass',
  },
  {
    name: 'first section → blue',
    message: 'Change the background of the first section to blue',
    color: 'blue',
    field: 'backgroundClass',
  },
  {
    name: 'site-wide blue theme',
    message: 'Change the entire site background to blue',
    siteWide: true,
  },
  {
    name: 'ambiguous → clarification',
    message: 'Make that section yellow',
    expectClarify: true,
  },
];

llmDescribe('Section presentation tokens — live LLM suite', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    if (workspacePath) {
      await cleanupPresentationWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  describe('V2 planner (planEdit)', () => {
    for (const testCase of PLANNER_CASES) {
      it(
        testCase.name,
        async () => {
          const plan = await planWithLiveLlm(testCase.message);

          if (testCase.expectClarify) {
            expect(plan.needsClarification).toBe(true);
            expect(plan.route).toBe('clarify');
            return;
          }

          if (testCase.forbidSectionStyle) {
            const styleStep = findV2StyleStep(plan);
            if (plan.needsClarification) {
              expect(plan.clarificationQuestion || plan.summary).toBeTruthy();
              return;
            }
            if (testCase.expectThemeSkill) {
              const hasTheme = plan.steps.some(
                (s) => s.skill === 'update_theme' || s.skill === 'legacy_strategy'
              );
              expect(hasTheme || !styleStep).toBe(true);
            }
            return;
          }

          assertV2PlannerSectionStyle(plan, {
            color: testCase.color,
            sectionIndex: testCase.sectionIndex,
          });
        },
      );
    }
  });

  describe('V2 E2E (planner + executor)', () => {
    for (const testCase of E2E_CASES) {
      it(
        testCase.name,
        async () => {
          workspacePath = await createPresentationTestWorkspace();

          const result = await runWebsiteEditAgentV2({
            workspacePath,
            ownerMessage: testCase.message,
            projectId: 'llm-presentation-e2e',
            mode: 'gitlab',
          });

          const siteConfig = await readWorkspaceSiteConfig(workspacePath);
          const page = await readWorkspacePage(workspacePath);
          const globals = await fs.readFile(
            path.join(workspacePath, 'src/app/globals.css'),
            'utf-8'
          );

          if (testCase.expectClarify) {
            expect(result.needsClarification).toBe(true);
            assertNoStyleSubtitleHack(siteConfig);
            return;
          }

          if (testCase.siteWide) {
            if (result.needsClarification) {
              expect(result.ok).toBe(false);
              return;
            }
            if (result.ok) {
              assertSiteWideThemeNotSectionPresentation(siteConfig, `${page}\n${globals}`);
            }
            assertNoStyleSubtitleHack(siteConfig);
            return;
          }

          assertV2EditSucceededForPresentation(result, siteConfig, {
            color: testCase.color,
            field: testCase.field,
          });
        },
      );
    }
  });

  describe('runWebsiteEdit production router', () => {
    it(
      'V2 flag: gallery yellow uses presentation in siteConfig',
      async () => {
        const prev = process.env.WEBSITE_AGENT_V2;
        process.env.WEBSITE_AGENT_V2 = 'true';
        workspacePath = await createPresentationTestWorkspace();

        try {
          const result = await runWebsiteEdit({
            workspacePath,
            ownerMessage: 'Change the Hello gallery section background to yellow',
            projectId: 'llm-presentation-router-v2',
            mode: 'gitlab',
          });

          const siteConfig = await readWorkspaceSiteConfig(workspacePath);
          if (result.ok) {
            assertSiteConfigPresentationField(siteConfig, {
              color: 'yellow',
              field: 'backgroundClass',
            });
          } else if (!result.needsClarification) {
            expect(result.error ?? result.ownerMessage).toBeTruthy();
          }
        } finally {
          if (prev === undefined) delete process.env.WEBSITE_AGENT_V2;
          else process.env.WEBSITE_AGENT_V2 = prev;
        }
      },
    );

    it(
      'V1 flag: section_style writes presentation without subtitle hack',
      async () => {
        const prevV2 = process.env.WEBSITE_AGENT_V2;
        process.env.WEBSITE_AGENT_V2 = 'false';
        workspacePath = await createPresentationTestWorkspace();

        try {
          const result = await runWebsiteEditAgent({
            workspacePath,
            ownerMessage: 'Change the Hello gallery section background to yellow',
            projectId: 'llm-presentation-v1',
            mode: 'gitlab',
          });

          const siteConfig = await readWorkspaceSiteConfig(workspacePath);
          assertNoStyleSubtitleHack(siteConfig);

          if (result.ok) {
            expect(result.strategy).toBe('section_style');
            assertSiteConfigPresentationField(siteConfig, {
              color: 'yellow',
              field: 'backgroundClass',
            });
          } else if (result.needsClarification) {
            expect(result.ownerMessage?.trim().length).toBeGreaterThan(0);
          } else {
            expect(result.error ?? result.ownerMessage).toBeTruthy();
          }
        } finally {
          if (prevV2 === undefined) delete process.env.WEBSITE_AGENT_V2;
          else process.env.WEBSITE_AGENT_V2 = prevV2;
        }
      },
    );
  });

  describe('In-progress planner (planner/planEdit + site model)', () => {
    const PLANNER_INTEGRATION_CASES = [
      {
        name: 'plans update_section_style for gallery yellow',
        message: 'Change the Hello gallery section background to yellow',
        color: 'yellow',
      },
      {
        name: 'plans update_section_style for about blue',
        message: 'Change the About Us section background to blue',
        color: 'blue',
      },
      {
        name: 'plans update_section_style for testimonial cards',
        message: 'Make the testimonial cards red in What Our Customers Say',
        color: 'red',
      },
    ];

    for (const testCase of PLANNER_INTEGRATION_CASES) {
      it(
        testCase.name,
        async () => {
          workspacePath = await createPresentationTestWorkspace();
          const siteModel = await getSiteModel({
            workspacePath,
            mode: 'gitlab',
          });

          const result = await planEdit({
            siteModel,
            userPrompt: testCase.message,
          });

          expect(result.ok, result.error).toBe(true);
          assertPlannerSectionStyle(result.plan!, { color: testCase.color });
        },
      );
    }

    it(
      'executes update_section_style end-to-end via V2 after planner/planEdit shape',
      async () => {
        workspacePath = await createPresentationTestWorkspace();

        const result = await runWebsiteEditAgentV2({
          workspacePath,
          ownerMessage: 'Change the Hello gallery section background to yellow',
          projectId: 'llm-planner-executor',
          mode: 'gitlab',
        });

        const siteConfig = await readWorkspaceSiteConfig(workspacePath);
        assertV2EditSucceededForPresentation(result, siteConfig, {
          color: 'yellow',
          field: 'backgroundClass',
        });
      },
    );
  });
});
