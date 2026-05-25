/**
 * Measure "change background to blue" on a project workspace (agent + verification).
 * Usage: npx tsx --env-file=.env scripts/measure-blue-background-edit.ts [projectId]
 */

import { promises as fs } from 'fs';
import path from 'path';
import { runWebsiteEditAgent } from '../src/lib/project-workspace/website-edit-agent';
import { verifyEditApplied } from '../src/lib/project-workspace/website-edit-agent/verifyEditApplied';
import { getGitWorkspacePath } from '../src/lib/project-workspace/gitWorkspaceManager';
import { validateWorkspace } from '../src/lib/project-workspace/validateWorkspace';

const PROJECT_ID = process.argv[2] || '6a135ba264e7672599597ea1';
const PROMPT = 'change background to blue';
const PAGE_REL = 'src/app/page.tsx';
const GLOBALS_REL = 'src/app/globals.css';

function analyzePage(content: string) {
  const hasBlue = /bg-blue(?:-\d{2,3})?/i.test(content);
  const hasGreen = /bg-green(?:-\d{2,3})?/i.test(content);
  const hasRed = /bg-red(?:-\d{2,3})?/i.test(content);
  const pageBg = content.match(/"pageBg"\s*:\s*"([^"]+)"/)?.[1] ?? null;
  const heroBg = content.match(/"heroBg"\s*:\s*"([^"]+)"/)?.[1]?.slice(0, 80) ?? null;
  return { hasBlue, hasGreen, hasRed, pageBg, heroBg };
}

async function readRel(workspacePath: string, rel: string): Promise<string> {
  try {
    return await fs.readFile(path.join(workspacePath, rel), 'utf-8');
  } catch {
    return '';
  }
}

async function main() {
  const workspacePath = getGitWorkspacePath(PROJECT_ID);
  const pageBefore = await readRel(workspacePath, PAGE_REL);
  const globalsBefore = await readRel(workspacePath, GLOBALS_REL);

  console.log('=== Blue background edit measurement ===');
  console.log(`Project:   ${PROJECT_ID}`);
  console.log(`Workspace: ${workspacePath}`);
  console.log(`Prompt:    ${PROMPT}`);
  console.log(`LLM:       ${process.env.LLM_PROVIDER || '(default)'}`);
  console.log('\n--- Before ---');
  console.log(analyzePage(pageBefore));

  const beforeFiles: Record<string, string> = {};
  if (pageBefore) beforeFiles[PAGE_REL] = pageBefore;
  if (globalsBefore) beforeFiles[GLOBALS_REL] = globalsBefore;

  const t0 = Date.now();
  const steps: { id: string; label: string; status: string; atMs: number }[] = [];

  const result = await runWebsiteEditAgent(
    {
      workspacePath,
      ownerMessage: PROMPT,
      projectId: PROJECT_ID,
      mode: 'gitlab',
    },
    (event) => {
      if (event.type === 'step') {
        steps.push({
          id: event.id,
          label: event.label,
          status: event.status,
          atMs: Date.now() - t0,
        });
      }
    }
  );

  const elapsedMs = Date.now() - t0;
  const pageAfter = await readRel(workspacePath, PAGE_REL);
  const globalsAfter = await readRel(workspacePath, GLOBALS_REL);

  const afterFiles = { ...beforeFiles, [PAGE_REL]: pageAfter, [GLOBALS_REL]: globalsAfter };
  const verification = verifyEditApplied(PROMPT, beforeFiles, afterFiles);

  let validation: Awaited<ReturnType<typeof validateWorkspace>> | null = null;
  if (result.ok && result.changedFiles?.length) {
    validation = await validateWorkspace(workspacePath, {
      changedFiles: result.changedFiles,
    });
  }

  console.log('\n--- Agent result ---');
  console.log({
    ok: result.ok,
    strategy: result.strategy,
    elapsedSec: (elapsedMs / 1000).toFixed(1),
    error: result.error,
    ownerMessage: result.ownerMessage?.slice(0, 200),
    changedFiles: result.changedFiles,
  });

  console.log('\n--- Verification (verifyEditApplied) ---');
  console.log(verification);

  console.log('\n--- After (page.tsx) ---');
  console.log(analyzePage(pageAfter));

  if (validation) {
    console.log('\n--- validateWorkspace ---');
    console.log({
      ok: validation.ok,
      errors: validation.errors?.slice(0, 3),
      warnings: validation.warnings?.slice(0, 3),
    });
  }

  console.log('\n--- Step timeline (ms) ---');
  for (const s of steps) {
    console.log(`  ${s.atMs}ms  ${s.id}  ${s.status}  ${s.label}`);
  }

  const wouldShowChangesTab =
    !result.ok && (result.changedFiles?.length ?? 0) > 0;
  console.log('\n--- UI behavior estimate ---');
  console.log({
    chatSuccess: result.ok,
    wouldAutoSwitchToChangesTab: wouldShowChangesTab,
    reason: wouldShowChangesTab
      ? 'Agent failed but files changed on disk → edit/stream sets showChangesTab'
      : result.ok
        ? 'Success → stays on chat, preview refresh'
        : 'Failed with no file changes',
  });

  process.exit(result.ok && verification.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
