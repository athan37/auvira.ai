import { describe, expect, it } from 'vitest';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { resolveImplicitReferences } from '@/lib/project-workspace/edit-context/implicitReferenceResolver';
import { executePlan } from '@/lib/project-workspace/edit-agent/executePlan';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';
import { heroClarificationReplaySiteSpec } from '../support/heroClarificationReplaySiteSpec';

const OWNER_MESSAGE = 'change background to my favorite color';

describe('hero pin + favorite color (implicit ref → update_theme)', () => {
  it('executes hero theme update when favorite color resolves from Monitor intent', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: heroClarificationReplaySiteSpec(),
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    try {
      const ctx = await buildEditContext({
        workspacePath,
        mode: 'gitlab',
        ownerMessage: OWNER_MESSAGE,
        selectedTarget: { kind: 'hero' },
        infraBaselineReady: true,
      });
      expect(ctx.context.target.kind).toBe('hero');

      const implicit = await resolveImplicitReferences({
        ownerMessage: OWNER_MESSAGE,
        editContext: ctx.context,
        projectIntent: {
          sentence:
            "Change the hero background (preset.heroBg) to blue, the owner's favorite color.",
        },
      });
      expect(implicit.needsClarification).toBeUndefined();
      expect(implicit.references[0]?.resolvedValue).toBe('blue');
      expect(implicit.resolvedMessage).toContain('blue');

      ctx.context.effectiveMessage = implicit.resolvedMessage!;

      const plan = await planEdit({
        editContext: ctx.context,
        userPrompt: OWNER_MESSAGE,
        deterministicOnly: true,
      });
      expect(plan.ok, plan.error).toBe(true);
      expect(plan.plan?.steps[0]?.skill).toBe('update_theme');

      const result = await executePlan(plan.plan!, ctx.context, {
        workspacePath,
        ownerMessage: OWNER_MESSAGE,
        mode: 'gitlab',
        projectId: 'hero-favorite-color-pinned',
        infraBaselineReady: true,
      });
      expect(result.ok, result.error ?? result.ownerMessage).toBe(true);

      const page = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
      expect(page).toMatch(/heroBg.*blue/i);
    } finally {
      await destroySyntheticWorkspace(workspacePath);
    }
  });
});
