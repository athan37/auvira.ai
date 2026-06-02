import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import {
  createServiceProMagicReplayWorkspace,
  SERVICEPRO_GENERIC_TITLE,
  SERVICEPRO_HERO_GRADIENT_MSG,
} from '../../support/serviceProMagicReplayWorkspace';

describe('ServiceProMagic hero gradient replay', () => {
  let workspacePath = '';

  afterEach(async () => {
    if (workspacePath) {
      await fs.rm(workspacePath, { recursive: true, force: true, maxRetries: 3 });
      workspacePath = '';
    }
  });

  it('turn 1: routes quoted hero headline to update_theme (hero scope)', async () => {
    workspacePath = await createServiceProMagicReplayWorkspace();

    const ctx = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: SERVICEPRO_HERO_GRADIENT_MSG,
      conversationHistory: [],
      infraBaselineReady: true,
    });

    expect(ctx.context.target.kind).toBe('hero');
    expect(ctx.needsClarification).toBe(false);

    const plan = await planEdit({ editContext: ctx.context, userPrompt: SERVICEPRO_HERO_GRADIENT_MSG });
    expect(plan.ok).toBe(true);
    expect(plan.plan?.needsClarification).toBe(false);
    expect(plan.plan?.steps[0]?.skill).toBe('update_theme');
  }, 30_000);

  it('turn 2: repeat message after clarify still targets hero', async () => {
    workspacePath = await createServiceProMagicReplayWorkspace();
    const history = [
      { role: 'user' as const, content: SERVICEPRO_HERO_GRADIENT_MSG },
      {
        role: 'assistant' as const,
        content:
          "Could you please specify the exact green color gradient you'd like for the hero background?",
      },
    ];

    const ctx = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: SERVICEPRO_HERO_GRADIENT_MSG,
      conversationHistory: history,
      infraBaselineReady: true,
    });

    expect(ctx.context.target.kind).toBe('hero');
    const plan = await planEdit({ editContext: ctx.context, userPrompt: SERVICEPRO_HERO_GRADIENT_MSG });
    expect(plan.plan?.steps[0]?.skill).toBe('update_theme');
  }, 30_000);

  it('turn 1 E2E: applies hero background without wrong section edit', async () => {
    workspacePath = await createServiceProMagicReplayWorkspace();
    const pageBefore = await fs.readFile(path.join(workspacePath, 'src/app/page.tsx'), 'utf-8');

    const siteConfigBefore = await fs.readFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), 'utf-8');
    const genericBgBefore =
      siteConfigBefore.match(
        new RegExp(
          `"title": "${SERVICEPRO_GENERIC_TITLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?"backgroundClass": "([^"]*)"`,
        )
      )?.[1] ?? null;

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: SERVICEPRO_HERO_GRADIENT_MSG,
      conversationHistory: [],
      projectId: 'servicepromagic-replay',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.needsClarification, result.error ?? result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);

    const pageAfter = await fs.readFile(path.join(workspacePath, 'src/app/page.tsx'), 'utf-8');
    expect(pageAfter).not.toBe(pageBefore);
    expect(pageAfter).toMatch(/heroBg.*green/i);

    const siteConfig = await fs.readFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), 'utf-8');
    const genericBgAfter =
      siteConfig.match(
        new RegExp(
          `"title": "${SERVICEPRO_GENERIC_TITLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?"backgroundClass": "([^"]*)"`,
        )
      )?.[1] ?? null;
    expect(genericBgAfter).toBe(genericBgBefore);
  }, 120_000);
});
