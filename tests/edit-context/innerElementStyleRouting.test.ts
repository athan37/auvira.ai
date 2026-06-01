import { describe, expect, it, afterEach } from 'vitest';
import { buildDeterministicPlan } from '@/lib/project-workspace/edit-agent/deterministicPlan';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import {
  INNER_ELEMENT_STYLE_LLM_SCENARIOS,
  type InnerElementStyleScenario,
} from '../support/innerElementStyleContract';
import {
  createInnerElementStyleWorkspace,
} from '../support/innerElementStyleWorkspace';
import { destroySyntheticWorkspace } from '../support/syntheticSiteWorkspace';

async function buildContextForScenario(scenario: InnerElementStyleScenario) {
  const created = await createInnerElementStyleWorkspace(scenario.workspace);
  const built = await buildEditContext({
    workspacePath: created.workspacePath,
    mode: 'gitlab',
    ownerMessage: scenario.ownerMessage,
    infraBaselineReady: true,
    selectedTarget: {
      kind: 'section',
      sectionIndex: created.targetSectionIndex,
      sectionType: scenario.workspace.section.type,
      sectionTitle: scenario.workspace.section.title,
      sectionId: created.analyticsId,
      analyticsId: created.analyticsId,
    },
  });
  return { created, built };
}

describe('inner element style deterministic routing', () => {
  const workspaces: string[] = [];

  afterEach(async () => {
    while (workspaces.length) {
      await destroySyntheticWorkspace(workspaces.pop()!);
    }
  });

  for (const scenario of INNER_ELEMENT_STYLE_LLM_SCENARIOS) {
    it(`deterministic plan for ${scenario.id}`, async () => {
      const { created, built } = await buildContextForScenario(scenario);
      workspaces.push(created.workspacePath);

      expect(built.needsClarification, built.clarificationMessage).toBe(false);
      const plan = buildDeterministicPlan(built.context);
      expect(plan?.needsClarification, JSON.stringify(plan)).toBe(false);
      expect(plan?.steps[0]?.skill).toBe('update_section_style');

      const field = plan?.steps[0]?.params?.presentationField;
      if (scenario.expect.mode === 'inner-card') {
        expect(field).toBe('cardClass');
      } else {
        expect(field).toBe('backgroundClass');
      }
    });
  }
});
