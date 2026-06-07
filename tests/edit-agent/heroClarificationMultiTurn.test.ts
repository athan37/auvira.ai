import { describe, expect, it } from 'vitest';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { resolveEditTargetSync } from '@/lib/project-workspace/edit-context/resolveEditTarget';
import { buildSiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';
import {
  heroClarificationHistoryThroughTurn2,
  heroClarificationHistoryThroughTurn3,
  heroClarificationReplaySiteSpec,
  HERO_CLARIFICATION_TURN1,
  HERO_CLARIFICATION_TURN3,
} from '../support/heroClarificationReplaySiteSpec';
import { resolveEffectiveEditMessage } from '@/lib/chat/conversationContextForEdit';
import { executePlan } from '@/lib/project-workspace/edit-agent/executePlan';

describe('hero clarification multi-turn (6a1f8d-style)', () => {
  it('turn 1: "hero section" phrasing resolves to hero target', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: heroClarificationReplaySiteSpec(),
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    try {
      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const page = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
      const catalog = buildSiteSectionCatalog(siteConfig, page);
      const ctx = await buildEditContext({
        workspacePath,
        mode: 'gitlab',
        ownerMessage: HERO_CLARIFICATION_TURN1,
        infraBaselineReady: true,
      });
      expect(ctx.context.target.kind).toBe('hero');
      const syncTarget = resolveEditTargetSync(
        HERO_CLARIFICATION_TURN1,
        ctx.context.siteModel,
        catalog
      );
      expect(syncTarget.kind).toBe('hero');
    } finally {
      await destroySyntheticWorkspace(workspacePath);
    }
  });

  it('turn 3 follow-up: gradient reply keeps hero target after color clarifications', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: heroClarificationReplaySiteSpec(),
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    try {
      const history = heroClarificationHistoryThroughTurn2();
      const effective = resolveEffectiveEditMessage(HERO_CLARIFICATION_TURN3, history);
      expect(effective.toLowerCase()).toContain('hero');

      const ctx = await buildEditContext({
        workspacePath,
        mode: 'gitlab',
        ownerMessage: HERO_CLARIFICATION_TURN3,
        conversationHistory: history,
        infraBaselineReady: true,
      });

      expect(ctx.context.target.kind).toBe('hero');
      expect(ctx.needsClarification).toBe(false);

      const plan = await planEdit({
        editContext: ctx.context,
        userPrompt: HERO_CLARIFICATION_TURN3,
        deterministicOnly: true,
      });
      expect(plan.ok).toBe(true);
      expect(plan.plan?.needsClarification).not.toBe(true);
      expect(plan.plan?.steps[0]?.skill).toBe('update_theme');
    } finally {
      await destroySyntheticWorkspace(workspacePath);
    }
  });

  it('turn 4 executePlan: hero gradient writes preset.heroBg', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: heroClarificationReplaySiteSpec(),
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    try {
      const history = heroClarificationHistoryThroughTurn2();
      const ctx = await buildEditContext({
        workspacePath,
        mode: 'gitlab',
        ownerMessage: HERO_CLARIFICATION_TURN3,
        conversationHistory: history,
        infraBaselineReady: true,
      });
      const plan = await planEdit({
        editContext: ctx.context,
        userPrompt: HERO_CLARIFICATION_TURN3,
        deterministicOnly: true,
      });
      expect(plan.plan?.steps[0]?.skill).toBe('update_theme');

      const result = await executePlan(plan.plan!, ctx.context, {
        workspacePath,
        ownerMessage: HERO_CLARIFICATION_TURN3,
        mode: 'gitlab',
        projectId: 'hero-clarification-exec',
        infraBaselineReady: true,
      });
      expect(result.ok, result.error ?? result.ownerMessage).toBe(true);

      const page = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
      expect(page).toMatch(/heroBg.*linear-gradient/i);
    } finally {
      await destroySyntheticWorkspace(workspacePath);
    }
  });

  it('after hero thread: "section about services" routes to services section style, not hero theme', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: heroClarificationReplaySiteSpec(),
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    try {
      const history = [
        ...heroClarificationHistoryThroughTurn3(),
        { role: 'assistant' as const, content: 'Updated hero background.' },
      ];
      const ownerMessage = 'Make the section about services have a purple background';
      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const page = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
      const catalog = buildSiteSectionCatalog(siteConfig, page);

      expect(resolveEffectiveEditMessage(ownerMessage, history, null, null, { catalog })).toBe(
        ownerMessage
      );

      const ctx = await buildEditContext({
        workspacePath,
        mode: 'gitlab',
        ownerMessage,
        conversationHistory: history,
        infraBaselineReady: true,
      });
      expect(ctx.context.target.kind).toBe('section');
      expect(ctx.context.target.sectionType).toBe('services');

      const plan = await planEdit({
        editContext: ctx.context,
        userPrompt: ownerMessage,
      });
      expect(plan.ok, plan.error).toBe(true);
      expect(plan.plan?.steps[0]?.skill).toBe('update_section_style');
    } finally {
      await destroySyntheticWorkspace(workspacePath);
    }
  });
});
