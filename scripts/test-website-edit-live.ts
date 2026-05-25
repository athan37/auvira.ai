/**
 * Live integration test for TypeScript WebsiteEditAgent against a real workspace.
 * Requires MiniMax proxy on :3457 (see README §8).
 *
 * Usage: npx tsx scripts/test-website-edit-live.ts [projectId]
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { runWebsiteEditAgent } from '../src/lib/project-workspace/website-edit-agent';
import { getGitWorkspacePath } from '../src/lib/project-workspace/gitWorkspaceManager';

process.env.LLM_PROVIDER = process.env.LLM_PROVIDER || 'minimax';

const PROJECT_ID = process.argv[2] || '6a11f1ed3d72da67984db587';
const SOURCE_WORKSPACE = getGitWorkspacePath(PROJECT_ID);
const LIVE_BASE = path.resolve('.tmp/git-workspaces', `_live-test-${PROJECT_ID}`);

type HardCase = {
  id: string;
  prompt: string;
  timeoutMs: number;
  assert?: (workspacePath: string) => Promise<string | null>;
};

const HARD_CASES: HardCase[] = [
  {
    id: 'style-blue-background',
    prompt: 'change the website background to blue so it is clearly visible in the preview',
    timeoutMs: 120_000,
    assert: async (ws) => {
      const css = await readIfExists(path.join(ws, 'src/app/globals.css'));
      const page = await readIfExists(path.join(ws, 'src/app/page.tsx'));
      const blob = `${css}\n${page}`.toLowerCase();
      if (blob.includes('blue') || /#2563eb|#3b82f6|#1d4ed8|#0000ff/.test(blob)) {
        return null;
      }
      return 'Expected blue color in globals.css or page.tsx';
    },
  },
  {
    id: 'section-faq-3',
    prompt:
      'add an FAQ section with exactly 3 questions and answers about our services. Make it visible on the homepage.',
    timeoutMs: 240_000,
    assert: async (ws) => {
      const page = await readIfExists(path.join(ws, 'src/app/page.tsx'));
      const config = await readIfExists(path.join(ws, 'src/lib/siteConfig.ts'));
      const blob = `${page}\n${config}`.toLowerCase();
      if (!blob.includes('faq') && !blob.includes('frequently')) {
        return 'Expected FAQ content in page.tsx or siteConfig.ts';
      }
      const qCount = (blob.match(/\?/g) || []).length;
      if (qCount < 3) {
        return `Expected at least 3 question marks, found ${qCount}`;
      }
      return null;
    },
  },
  {
    id: 'copy-vague-hero-headline',
    prompt: 'Change the hero headline',
    timeoutMs: 180_000,
    assert: async (ws) => {
      const config = await readIfExists(path.join(ws, 'src/lib/siteConfig.ts'));
      const page = await readIfExists(path.join(ws, 'src/app/page.tsx'));
      const blob = `${config}\n${page}`;
      if (!blob.match(/headline:\s*['"][^'"]{4,}['"]/i) && !blob.includes('<h1')) {
        return 'Expected an updated hero headline in siteConfig or page.tsx';
      }
      return null;
    },
  },
  {
    id: 'copy-hero-headline',
    prompt: 'update the main hero headline to: Built for Houston Homeowners',
    timeoutMs: 180_000,
    assert: async (ws) => {
      const page = await readIfExists(path.join(ws, 'src/app/page.tsx'));
      const config = await readIfExists(path.join(ws, 'src/lib/siteConfig.ts'));
      const blob = `${page}\n${config}`;
      if (!blob.includes('Built for Houston Homeowners')) {
        return 'Expected new hero headline in page or siteConfig';
      }
      return null;
    },
  },
  {
    id: 'section-testimonials',
    prompt:
      'add a testimonials section with 2 short customer quotes and names. Do not invent phone numbers or addresses.',
    timeoutMs: 240_000,
    assert: async (ws) => {
      const page = await readIfExists(path.join(ws, 'src/app/page.tsx'));
      const config = await readIfExists(path.join(ws, 'src/lib/siteConfig.ts'));
      const blob = `${page}\n${config}`.toLowerCase();
      if (!blob.includes('testimonial') && !blob.includes('review') && !blob.includes('quote')) {
        return 'Expected testimonials/reviews section content';
      }
      return null;
    },
  },
  {
    id: 'style-dark-gold',
    prompt:
      'switch the site to a dark theme with gold accent colors on buttons and headings. Update globals.css and page styling.',
    timeoutMs: 240_000,
    assert: async (ws) => {
      const css = await readIfExists(path.join(ws, 'src/app/globals.css'));
      const page = await readIfExists(path.join(ws, 'src/app/page.tsx'));
      const blob = `${css}\n${page}`.toLowerCase();
      const hasDark =
        blob.includes('dark') ||
        blob.includes('#0f') ||
        blob.includes('#111') ||
        blob.includes('#1a') ||
        blob.includes('bg-black');
      const hasGold =
        blob.includes('gold') ||
        blob.includes('#d4af') ||
        blob.includes('#f59') ||
        blob.includes('amber');
      if (!hasDark || !hasGold) {
        return `Expected dark + gold styling (dark=${hasDark}, gold=${hasGold})`;
      }
      return null;
    },
  },
];

async function readIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}

async function prepareWorkspace(): Promise<string> {
  const dest = path.join(LIVE_BASE, 'repo');
  await fs.rm(LIVE_BASE, { recursive: true, force: true });
  await fs.mkdir(path.dirname(dest), { recursive: true });

  try {
    execSync(`cp -R "${SOURCE_WORKSPACE}/." "${dest}/"`, { stdio: 'pipe' });
  } catch {
    throw new Error(`Failed to copy workspace from ${SOURCE_WORKSPACE}`);
  }

  return dest;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

async function runCase(workspacePath: string, testCase: HardCase) {
  const started = Date.now();
  const steps: string[] = [];

  const result = await withTimeout(
    runWebsiteEditAgent(
      {
        workspacePath,
        ownerMessage: testCase.prompt,
        projectId: PROJECT_ID,
        mode: 'gitlab',
      },
      (event) => {
        if (event.type === 'step') {
          steps.push(`${event.id}:${event.status}`);
        }
      }
    ),
    testCase.timeoutMs,
    testCase.id
  );

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  let assertError: string | null = null;
  if (result.ok && testCase.assert) {
    assertError = await testCase.assert(workspacePath);
  }

  return {
    id: testCase.id,
    ok: result.ok && !assertError,
    strategy: result.strategy,
    error: assertError || result.error,
    ownerMessage: result.ownerMessage,
    changedFiles: result.changedFiles ?? [],
    elapsedSec: elapsed,
    steps: steps.filter((s) => s.endsWith(':completed') || s.endsWith(':failed')).slice(-8),
  };
}

async function main() {
  console.log('WebsiteEditAgent live test');
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Source:  ${SOURCE_WORKSPACE}`);
  const llmTarget =
    process.env.LLM_PROVIDER === 'minimax-proxy'
      ? process.env.MINIMAX_PROXY_URL
      : process.env.MINIMAX_API_URL || 'https://api.minimax.io/anthropic/v1/messages';
  console.log(`LLM:     ${process.env.LLM_PROVIDER} @ ${llmTarget}\n`);

  try {
    await fs.stat(SOURCE_WORKSPACE);
  } catch {
    console.error(`Workspace not found: ${SOURCE_WORKSPACE}`);
    process.exit(1);
  }

  const results: Awaited<ReturnType<typeof runCase>>[] = [];

  const only = process.env.ONLY?.split(',').map((s) => s.trim()).filter(Boolean);
  const cases = only?.length ? HARD_CASES.filter((c) => only.includes(c.id)) : HARD_CASES;

  for (const testCase of cases) {
    console.log(`\n--- ${testCase.id} ---`);
    console.log(`Prompt: ${testCase.prompt.slice(0, 80)}...`);

    const workspacePath = await prepareWorkspace();

    try {
      const result = await runCase(workspacePath, testCase);
      results.push(result);
      const icon = result.ok ? 'PASS' : 'FAIL';
      console.log(
        `[${icon}] ${result.elapsedSec}s strategy=${result.strategy ?? 'n/a'} files=${result.changedFiles.length}`
      );
      if (result.changedFiles.length) {
        console.log(`  Changed: ${result.changedFiles.slice(0, 8).join(', ')}`);
      }
      if (!result.ok) {
        console.log(`  Error: ${result.error ?? 'unknown'}`);
      } else if (result.ownerMessage) {
        console.log(`  Message: ${result.ownerMessage.slice(0, 120)}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        id: testCase.id,
        ok: false,
        strategy: undefined,
        error: msg,
        ownerMessage: undefined,
        changedFiles: [],
        elapsedSec: '?',
        steps: [],
      });
      console.log(`[FAIL] ${msg}`);
    }
  }

  await fs.rm(LIVE_BASE, { recursive: true, force: true });

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n========== Summary: ${passed}/${results.length} passed ==========`);
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.id} (${r.elapsedSec}s) ${r.strategy ?? ''}`);
  }

  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
