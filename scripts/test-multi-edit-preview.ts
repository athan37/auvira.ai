/**
 * End-to-end: bootstrap local preview, run multiple edits, verify preview health after each.
 *
 * Usage:
 *   SITE_AGENT_DEV_BYPASS_AUTH=1 npx tsx --env-file=.env scripts/test-multi-edit-preview.ts [projectId]
 */

import { promises as fs } from 'fs';
import path from 'path';
import { connectMongoDB } from '../src/lib/mongodb';
import { WebsiteProject } from '../src/models/WebsiteProject';
import {
  bootstrapProjectPreview,
  checkPreviewHealthy,
} from '../src/lib/project-workspace/bootstrapProjectPreview';
import { runWebsiteEditAgent } from '../src/lib/project-workspace/website-edit-agent';
import { validateWorkspace } from '../src/lib/project-workspace/validateWorkspace';
import { getGitWorkspacePath } from '../src/lib/project-workspace/gitWorkspaceManager';
import { repairPreviewWorkspace } from '../src/lib/preview/repairPreviewWorkspace';

const PROJECT_ID = process.argv[2] || '6a135ba264e7672599597ea1';
const DEV_USER = '507f1f77bcf86cd799439011';

type EditCase = {
  id: string;
  prompt: string;
  assertPreview?: (html: string) => string | null;
};

const EDIT_CASES: EditCase[] = [
  {
    id: 'blue-bg',
    prompt: 'change background to blue',
    assertPreview: (html) =>
      /bg-blue|#1e3a8a|#1d4ed8|#2563eb/i.test(html) ? null : 'preview HTML missing blue styling',
  },
  {
    id: 'hero-headline',
    prompt: 'Change the hero headline to: Built for Houston Homeowners',
    assertPreview: (html) =>
      html.includes('Built for Houston Homeowners') ? null : 'headline not in preview HTML',
  },
  {
    id: 'green-bg',
    prompt: 'change the page background to green',
    assertPreview: (html) =>
      /bg-green-\d{3}|text-green-|border-green-/i.test(html)
        ? null
        : 'preview HTML missing green Tailwind classes',
  },
];

async function waitForHmr(ms = 2500): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchPreviewHtml(port: number): Promise<{ status: number; html: string; ms: number }> {
  const url = `http://127.0.0.1:${port}/?t=${Date.now()}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const html = await res.text();
  return { status: res.status, html, ms: Date.now() - t0 };
}

async function readPageSnippet(workspacePath: string): Promise<string> {
  try {
    const page = await fs.readFile(path.join(workspacePath, 'src/app/page.tsx'), 'utf-8');
    const pageBg = page.match(/"pageBg"\s*:\s*"([^"]+)"/)?.[1];
    const headline = page.match(/headline:\s*['"]([^'"]+)['"]/)?.[1];
    return `pageBg=${pageBg ?? '?'} headline=${headline ?? '?'}`;
  } catch {
    return '(no page.tsx)';
  }
}

async function runOneEdit(
  workspacePath: string,
  editCase: EditCase,
  port: number
): Promise<Record<string, unknown>> {
  const t0 = Date.now();
  const beforeSnippet = await readPageSnippet(workspacePath);

  const agent = await runWebsiteEditAgent({
    workspacePath,
    ownerMessage: editCase.prompt,
    projectId: PROJECT_ID,
    mode: 'gitlab',
  });

  const agentMs = Date.now() - t0;
  let validation: { ok: boolean; errors: string[] } = { ok: false, errors: [] };
  if (agent.ok && agent.changedFiles?.length) {
    await repairPreviewWorkspace(workspacePath);
    const v = await validateWorkspace(workspacePath, { changedFiles: agent.changedFiles });
    validation = { ok: v.ok, errors: v.errors ?? [] };
  }

  const healthy = await checkPreviewHealthy(port, 12_000);
  let preview = { status: 0, ms: 0, assertError: 'skipped' as string | null };
  if (healthy) {
    await waitForHmr();
    try {
      const fetched = await fetchPreviewHtml(port);
      preview = {
        status: fetched.status,
        ms: fetched.ms,
        assertError: editCase.assertPreview?.(fetched.html) ?? null,
      };
    } catch (err) {
      preview = {
        status: 0,
        ms: 0,
        assertError: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    preview.assertError = 'preview health check failed';
  }

  const afterSnippet = await readPageSnippet(workspacePath);

  return {
    id: editCase.id,
    prompt: editCase.prompt,
    agentOk: agent.ok,
    strategy: agent.strategy,
    agentMs,
    agentError: agent.error,
    changedFiles: agent.changedFiles ?? [],
    beforeSnippet,
    afterSnippet,
    validationOk: validation.ok,
    validationErrors: validation.errors.slice(0, 2),
    previewHealthy: healthy,
    previewStatus: preview.status,
    previewFetchMs: preview.ms,
    previewAssert: preview.assertError,
    pass:
      agent.ok &&
      validation.ok &&
      healthy &&
      preview.status >= 200 &&
      preview.status < 500 &&
      !preview.assertError,
  };
}

async function main() {
  if (process.env.SITE_AGENT_DEV_BYPASS_AUTH !== '1') {
    console.error('Set SITE_AGENT_DEV_BYPASS_AUTH=1');
    process.exit(1);
  }

  await connectMongoDB();
  const project = await WebsiteProject.findById(PROJECT_ID);
  if (!project) {
    console.error('Project not found:', PROJECT_ID);
    process.exit(1);
  }

  const workspacePath = getGitWorkspacePath(PROJECT_ID);
  console.log('=== Multi-edit local preview test ===');
  console.log('Project:', project.name, PROJECT_ID);
  console.log('Workspace:', workspacePath);
  console.log('LLM:', process.env.LLM_PROVIDER || '(default)');
  console.log('Edits:', EDIT_CASES.map((c) => c.id).join(', '));
  console.log('');

  const bootT0 = Date.now();
  await bootstrapProjectPreview(project, DEV_USER);
  const updated = await WebsiteProject.findById(PROJECT_ID);
  const port = updated?.preview?.port;
  if (!port) {
    console.error('Bootstrap did not assign preview port');
    process.exit(1);
  }
  console.log(`Bootstrap: ${Math.round((Date.now() - bootT0) / 1000)}s → port ${port}`);
  const bootHealthy = await checkPreviewHealthy(port);
  console.log(`Initial health: ${bootHealthy ? 'OK' : 'FAIL'}`);
  if (!bootHealthy) {
    console.error('Cannot continue — preview not healthy after bootstrap');
    process.exit(1);
  }
  const initial = await fetchPreviewHtml(port);
  console.log(`Initial fetch: HTTP ${initial.status} in ${initial.ms}ms (${initial.html.length} bytes)\n`);

  const results: Record<string, unknown>[] = [];
  for (const editCase of EDIT_CASES) {
    console.log(`--- ${editCase.id} ---`);
    console.log(`Prompt: ${editCase.prompt}`);
    const row = await runOneEdit(workspacePath, editCase, port);
    results.push(row);
    const icon = row.pass ? 'PASS' : 'FAIL';
    console.log(`[${icon}] agent=${row.agentOk} (${row.agentMs}ms) validate=${row.validationOk} health=${row.previewHealthy} http=${row.previewStatus}`);
    console.log(`  before: ${row.beforeSnippet}`);
    console.log(`  after:  ${row.afterSnippet}`);
    if (row.changedFiles) console.log(`  files:  ${(row.changedFiles as string[]).join(', ')}`);
    if (!row.pass) {
      if (row.agentError) console.log(`  agent error: ${row.agentError}`);
      if (row.validationErrors) console.log(`  validation: ${(row.validationErrors as string[]).join('; ')}`);
      if (row.previewAssert) console.log(`  preview: ${row.previewAssert}`);
    }
    console.log('');
  }

  const passed = results.filter((r) => r.pass).length;
  console.log('========== Summary ==========');
  console.log(`${passed}/${results.length} edits passed with healthy local preview`);
  for (const r of results) {
    console.log(`  ${r.pass ? '✓' : '✗'} ${r.id}  agent ${r.agentMs}ms  http ${r.previewStatus}`);
  }

  const recommendations: string[] = [];
  if (passed < results.length) {
    const failedAgent = results.filter((r) => !r.agentOk);
    const failedVal = results.filter((r) => r.agentOk && !r.validationOk);
    const failedHealth = results.filter((r) => r.agentOk && r.validationOk && !r.previewHealthy);
    const failedAssert = results.filter((r) => r.previewAssert && r.previewHealthy);

    if (failedAgent.length) {
      recommendations.push(
        'Agent failures: tighten prompts or add deterministic patchers for color/headline intents before LLM.'
      );
    }
    if (failedVal.length) {
      recommendations.push(
        'Validation failures: run repairPreviewWorkspace after every edit (already in this script); wire into edit/stream success path.'
      );
    }
    if (failedHealth.length) {
      recommendations.push(
        'Preview health failures: restart next dev after failed validation or run `next build` gate; consider HMR reload endpoint.'
      );
    }
    if (failedAssert.length) {
      recommendations.push(
        'HTML mismatch: Next may be serving cached RSC payload — bump iframe refreshKey on edit; or fetch with cache-bust query.'
      );
    }
  } else {
    recommendations.push('Local preview pipeline is healthy for tested edits.');
    recommendations.push(
      'Optimize: skip full validateWorkspace on trivial style edits; use repairPreviewWorkspace + HTTP health only (~10s faster).'
    );
  }

  console.log('\n--- Recommendations ---');
  for (const rec of recommendations) {
    console.log(`• ${rec}`);
  }

  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
