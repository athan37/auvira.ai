import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { planEdit } from '@/lib/project-workspace/planner/planEdit';
import { scratchPath } from '@/lib/runtime/scratchDir';

const SOURCE_WS = path.join(
  process.cwd(),
  '.tmp/git-workspaces/6a1bc4fdc795e45980a08f4e/repo'
);

const HERO_GRADIENT_MSG =
  'change color of the "Your HVAC Website Should Work as Hard as You Do" section\'s background from red to green color gradient';

async function cloneServiceProMagicWorkspace(): Promise<string> {
  const dest = scratchPath(`servicepromagic-replay-${randomUUID().slice(0, 8)}`);
  await fs.cp(SOURCE_WS, dest, { recursive: true });
  return dest;
}

describe.runIf(() => {
  try {
    require('fs').accessSync(SOURCE_WS);
    return true;
  } catch {
    return false;
  }
})('ServiceProMagic hero gradient replay', () => {
  let workspacePath = '';

  afterEach(async () => {
    if (workspacePath) {
      await fs.rm(workspacePath, { recursive: true, force: true, maxRetries: 3 });
      workspacePath = '';
    }
  });

  it('turn 1: routes quoted hero headline to update_theme (hero scope)', async () => {
    workspacePath = await cloneServiceProMagicWorkspace();

    const ctx = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: HERO_GRADIENT_MSG,
      conversationHistory: [],
      infraBaselineReady: true,
    });

    expect(ctx.context.target.kind).toBe('hero');
    expect(ctx.needsClarification).toBe(false);

    const plan = await planEdit({ editContext: ctx.context, userPrompt: HERO_GRADIENT_MSG });
    expect(plan.ok).toBe(true);
    expect(plan.plan?.needsClarification).toBe(false);
    expect(plan.plan?.steps[0]?.skill).toBe('update_theme');
  }, 30_000);

  it('turn 2: repeat message after clarify still targets hero', async () => {
    workspacePath = await cloneServiceProMagicWorkspace();
    const history = [
      { role: 'user' as const, content: HERO_GRADIENT_MSG },
      {
        role: 'assistant' as const,
        content:
          "Could you please specify the exact green color gradient you'd like for the hero background?",
      },
    ];

    const ctx = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: HERO_GRADIENT_MSG,
      conversationHistory: history,
      infraBaselineReady: true,
    });

    expect(ctx.context.target.kind).toBe('hero');
    const plan = await planEdit({ editContext: ctx.context, userPrompt: HERO_GRADIENT_MSG });
    expect(plan.plan?.steps[0]?.skill).toBe('update_theme');
  }, 30_000);

  it('turn 1 E2E: applies hero background without wrong section edit', async () => {
    workspacePath = await cloneServiceProMagicWorkspace();
    const pageBefore = await fs.readFile(path.join(workspacePath, 'src/app/page.tsx'), 'utf-8');

    const siteConfigBefore = await fs.readFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), 'utf-8');
    const genericBgBefore =
      siteConfigBefore.match(
        /"title": "See ServiceProMagic in Action"[\s\S]*?"backgroundClass": "([^"]*)"/
      )?.[1] ?? null;

    const result = await runWebsiteEditAgent({
      workspacePath,
      ownerMessage: HERO_GRADIENT_MSG,
      conversationHistory: [],
      projectId: 'servicepromagic-replay',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.needsClarification, result.error ?? result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);

    const pageAfter = await fs.readFile(path.join(workspacePath, 'src/app/page.tsx'), 'utf-8');
    expect(pageAfter).not.toBe(pageBefore);
    expect(pageAfter).toMatch(/heroBg.*linear-gradient.*22c55e/i);

    const siteConfig = await fs.readFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), 'utf-8');
    const genericBgAfter =
      siteConfig.match(
        /"title": "See ServiceProMagic in Action"[\s\S]*?"backgroundClass": "([^"]*)"/
      )?.[1] ?? null;
    expect(genericBgAfter).toBe(genericBgBefore);
  }, 120_000);
});
