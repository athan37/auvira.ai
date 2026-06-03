/**
 * Live LLM: explorer + intent clarifier on ambiguous pinned contact copy.
 *
 * Run: npm run test:llm (requires MINIMAX_API_KEY)
 */
import { afterEach, expect, it } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../llmTestGate';
import { stableAnalyticsIdForSection } from '@/lib/analytics/generated-sites/ensureAnalyticsIds';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
} from '../support/syntheticSiteWorkspace';

const CONTACT_SECTION = {
  type: 'contact' as const,
  title: 'Get Started Today',
  body: 'Encourage action with a clear CTA.',
};

const CONTACT_ID = stableAnalyticsIdForSection(CONTACT_SECTION, 0);

describeRunLlmIntegration('explorer agent (LLM)', () => {
  let workspacePath: string | undefined;
  const prevExplorer = process.env.WEBSITE_EDIT_EXPLORER;

  afterEach(async () => {
    if (prevExplorer === undefined) delete process.env.WEBSITE_EDIT_EXPLORER;
    else process.env.WEBSITE_EDIT_EXPLORER = prevExplorer;
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it(
    'pinned contact + vague inner phrase applies subtitle with explorer flag',
    async () => {
      process.env.WEBSITE_EDIT_EXPLORER = '1';
      workspacePath = await createSyntheticWorkspace({
        site: {
          businessName: 'Explorer Test Co',
          sections: [CONTACT_SECTION],
        },
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const built = await buildEditContext({
        workspacePath,
        mode: 'gitlab',
        ownerMessage: 'change contact information to Explorer Card Title',
        infraBaselineReady: true,
        selectedTarget: {
          kind: 'section',
          sectionIndex: 0,
          sectionType: 'contact',
          sectionTitle: 'Get Started Today',
          sectionId: CONTACT_ID,
          analyticsId: CONTACT_ID,
        },
      });

      const planned = await planEdit({
        editContext: built.context,
        userPrompt: built.context.ownerMessage,
        deterministicOnly: true,
      });

      expect(planned.ok, planned.error).toBe(true);
      expect(planned.plan?.needsClarification).toBeFalsy();
      const step = planned.plan?.steps[0];
      expect(step?.skill).toBe('update_config_field');
      expect(step?.params).toMatchObject({
        fieldPath: 'sections[0].subtitle',
        value: 'Explorer Card Title',
      });
    },
    LLM_TEST_TIMEOUT_MS
  );
});
