/**
 * Full LLM integration suite: section background gradient edits (quoted titles, color gradient).
 *
 * Covers the regression class:
 * - "Get Started Today" + color gradient → gradient in siteConfig, not bg-black
 * - Trusted-by testimonials + quoted title before "background"
 * - Overlapping section titles (confusing catalog)
 *
 * Run: npm run test:llm:gradients
 */
import '../../llmTestGate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../../llmTestGate';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import {
  assertSectionGradientContract,
  SECTION_GRADIENT_LLM_SCENARIOS,
  withSectionGradientScenario,
  type GradientAgentRunner,
} from '../../support/sectionGradientBackgroundContract';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
} from '../../support/syntheticSiteWorkspace';


const AGENTS: Array<{ label: string; run: GradientAgentRunner }> = [
  {
    label: 'v3',
    run: async ({ workspacePath, ownerMessage, projectId }) =>
      runWebsiteEditAgent({
        workspacePath,
        ownerMessage,
        projectId,
        mode: 'gitlab',
        infraBaselineReady: true,
      }),
  },
];

describeRunLlmIntegration('section gradient background (LLM integration)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  for (const agent of AGENTS) {
    describe(`${agent.label} agent`, () => {
      for (const scenario of SECTION_GRADIENT_LLM_SCENARIOS) {
        it(
          `${scenario.id}`,
          async () => {
            await withSectionGradientScenario(scenario, agent.run, agent.label, (run) => {
              assertSectionGradientContract(run);
            });
          },
          LLM_TEST_TIMEOUT_MS
        );
      }
    });
  }

  describe('V3 planner (LLM path smoke)', () => {
    let workspacePath: string | undefined;

    afterEach(async () => {
      if (workspacePath) {
        await destroySyntheticWorkspace(workspacePath);
        workspacePath = undefined;
      }
    });

    it(
      'planner returns gradient presentation for Get Started Today prompt',
      async () => {
        workspacePath = await createSyntheticWorkspace({
          site: {
            sections: [
              { type: 'services', title: 'Our Services' },
              { type: 'contact', title: 'Get Started Today' },
            ],
          },
          pageMode: 'wired',
          tailwind: 'canonical',
        });

        const ownerMessage =
          'change this section "Get Started Today" background to color gradient';

        const ctx = await buildEditContext({
          workspacePath,
          mode: 'gitlab',
          ownerMessage,
          infraBaselineReady: true,
        });

        const deterministic = await planEdit({
          editContext: ctx.context,
          userPrompt: ownerMessage,
          deterministicOnly: true,
        });

        if (deterministic.ok && deterministic.plan?.steps.length) {
          const params = JSON.stringify(deterministic.plan.steps[0]?.params ?? {});
          expect(params).toMatch(/gradient/i);
          return;
        }

        const planResult = await planEdit({
          editContext: ctx.context,
          userPrompt: ownerMessage,
        });

        expect(planResult.ok, planResult.error).toBe(true);
        expect(planResult.plan?.needsClarification, JSON.stringify(planResult.plan)).not.toBe(true);

        const styleStep = planResult.plan?.steps.find((s) => s.skill === 'update_section_style');
        expect(styleStep, JSON.stringify(planResult.plan?.steps)).toBeTruthy();

        const targetIndex =
          styleStep?.target?.sectionIndex ?? styleStep?.params?.sectionIndex;
        expect(targetIndex).toBe(1);

        const serialized = JSON.stringify(styleStep?.params ?? {}).toLowerCase();
        expect(
          serialized.includes('gradient') ||
            String(styleStep?.params?.backgroundClass ?? '').includes('gradient')
        ).toBe(true);
        expect(serialized).not.toMatch(/"backgroundcolor"\s*:\s*"black"/);
      },
      LLM_TEST_TIMEOUT_MS
    );
  });
});
