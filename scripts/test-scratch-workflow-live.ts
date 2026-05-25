/**
 * Live integration test: scratch release + 30m TTL prune.
 *
 * Usage:
 *   npx tsx scripts/test-scratch-workflow-live.ts
 *   npx tsx scripts/test-scratch-workflow-live.ts --http http://localhost:3000
 *   npx tsx scripts/test-scratch-workflow-live.ts --disk-inspect 6a11f1ed3d72da67984db587
 *   npx tsx scripts/test-scratch-workflow-live.ts --inspect 6a11f1ed3d72da67984db587  # needs MONGODB_URI
 *
 * Requires MONGODB_URI only for --inspect (read-only dir listing).
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  getScratchTtlMs,
  projectScratchDirs,
  pruneExpiredScratch,
  releaseProjectScratch,
} from '../src/lib/runtime/scratchCleanup';
import { getScratchRoot, scratchPath } from '../src/lib/runtime/scratchDir';

const args = process.argv.slice(2);
const httpBase = args.includes('--http')
  ? args[args.indexOf('--http') + 1] || 'http://localhost:3000'
  : null;
const inspectId = args.includes('--inspect')
  ? args[args.indexOf('--inspect') + 1]
  : null;
const diskInspectId = args.includes('--disk-inspect')
  ? args[args.indexOf('--disk-inspect') + 1]
  : null;

function log(step: string, detail?: string) {
  console.log(detail ? `[scratch-live] ${step}: ${detail}` : `[scratch-live] ${step}`);
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function assertGone(dirs: string[]): Promise<void> {
  for (const d of dirs) {
    if (await pathExists(d)) {
      throw new Error(`Expected removed but still exists: ${d}`);
    }
  }
}

async function assertExists(dirs: string[]): Promise<void> {
  for (const d of dirs) {
    if (!(await pathExists(d))) {
      throw new Error(`Expected to exist: ${d}`);
    }
  }
}

async function seedProjectScratch(projectId: string): Promise<void> {
  for (const dir of projectScratchDirs(projectId)) {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, '.e2e-marker'), `project=${projectId}\n`, 'utf-8');
  }
  const nestedSnapshot = scratchPath('edit-snapshots', projectId, '111111');
  await fs.mkdir(nestedSnapshot, { recursive: true });
  await fs.writeFile(path.join(nestedSnapshot, 'snap.txt'), 'nested', 'utf-8');
}

async function testSyntheticNewProject(): Promise<string> {
  const projectId = `e2e-new-${Date.now()}`;
  log('1/4', `Seeding scratch for new project ${projectId}`);
  await seedProjectScratch(projectId);

  const dirs = projectScratchDirs(projectId);
  await assertExists(dirs);

  log('2/4', 'Release on leave (immediate)');
  const { removed } = await releaseProjectScratch(projectId);
  if (removed.length < 4) {
    throw new Error(`Expected >=4 removed paths, got ${removed.length}: ${removed.join(', ')}`);
  }
  await assertGone(dirs);
  const nested = scratchPath('edit-snapshots', projectId);
  if (await pathExists(nested)) {
    throw new Error(`Nested edit-snapshots parent should be gone: ${nested}`);
  }

  log('3/4', 'TTL prune (30m) — stale neighbor');
  const staleId = `e2e-stale-${Date.now()}`;
  const staleDir = scratchPath('git-workspaces', staleId);
  await fs.mkdir(staleDir, { recursive: true });
  await fs.writeFile(path.join(staleDir, 'old.txt'), 'stale', 'utf-8');
  const fortyMinAgo = new Date(Date.now() - 40 * 60 * 1000);
  await fs.utimes(staleDir, fortyMinAgo, fortyMinAgo);

  const freshId = `e2e-fresh-${Date.now()}`;
  const freshDir = scratchPath('git-workspaces', freshId);
  await fs.mkdir(freshDir, { recursive: true });

  const ttl = getScratchTtlMs();
  log('TTL ms', String(ttl));
  const { removed: pruned } = await pruneExpiredScratch(ttl);
  if (!pruned.some((p) => p.includes(staleId))) {
    throw new Error(`Stale dir not pruned: ${staleDir}`);
  }
  if (!(await pathExists(freshDir))) {
    throw new Error(`Fresh dir should remain: ${freshDir}`);
  }
  await fs.rm(freshDir, { recursive: true, force: true }).catch(() => {});

  log('4/4', 'Synthetic new-project flow OK');
  return projectId;
}

async function testHttpReleaseRoute(base: string, projectId: string): Promise<void> {
  const url = `${base.replace(/\/$/, '')}/api/projects/${projectId}/workspace/release`;
  log('HTTP', `POST ${url} (expect 401 without session)`);
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST' });
  } catch (err) {
    log(
      'HTTP',
      `Skipped — server not reachable at ${base} (${err instanceof Error ? err.message : 'error'})`
    );
    return;
  }
  const body = await res.text();
  if (res.status !== 401 && res.status !== 404) {
    throw new Error(`Expected 401 or 404, got ${res.status}: ${body.slice(0, 200)}`);
  }
  log('HTTP', `Route reachable — status ${res.status}`);
}

async function inspectDiskScratch(projectId: string): Promise<void> {
  log('disk-inspect', `Scratch root: ${getScratchRoot()}`);
  for (const dir of projectScratchDirs(projectId)) {
    const exists = await pathExists(dir);
    const size = exists ? await dirSize(dir) : 0;
    log('disk-inspect', `${exists ? 'present' : 'absent'} ${dir} (${size} bytes)`);
  }
}

async function inspectRealProject(projectId: string): Promise<void> {
  if (!process.env.MONGODB_URI) {
    log('inspect', 'Skipped (no MONGODB_URI in environment)');
    return;
  }

  const { connectMongoDB } = await import('../src/lib/mongodb');
  const { WebsiteProject } = await import('../models/WebsiteProject');
  await connectMongoDB();

  const project = await WebsiteProject.findById(projectId).lean();
  if (!project) {
    throw new Error(`Project not found in DB: ${projectId}`);
  }

  log('inspect', `DB project "${project.name}" mode=${project.mode}`);
  const root = getScratchRoot();
  log('inspect', `Scratch root: ${root}`);

  for (const dir of projectScratchDirs(projectId)) {
    const exists = await pathExists(dir);
    let size = 0;
    if (exists) {
      size = await dirSize(dir);
    }
    log('inspect', `${exists ? 'present' : 'absent'} ${dir} (${size} bytes)`);
  }
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  const walk = async (d: string) => {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else {
        const st = await fs.stat(p);
        total += st.size;
      }
    }
  };
  try {
    await walk(dir);
  } catch {
    // ignore
  }
  return total;
}

async function main() {
  if (diskInspectId) {
    await inspectDiskScratch(diskInspectId);
  }

  const isolatedRoot = await fs.mkdtemp(
    path.join(process.cwd(), 'scratch-live-isolated-')
  );
  process.env.SITE_AGENT_SCRATCH_DIR = isolatedRoot;
  log('start', `isolated scratch root = ${getScratchRoot()}`);

  const projectId = await testSyntheticNewProject();

  if (httpBase) {
    await testHttpReleaseRoute(httpBase, projectId);
  } else {
    log('HTTP', 'Skipped (pass --http http://localhost:3000 to probe release route)');
  }

  if (inspectId) {
    await inspectRealProject(inspectId);
  }

  await fs.rm(isolatedRoot, { recursive: true, force: true }).catch(() => {});

  console.log('\n[scratch-live] All checks passed.');
}

main().catch((err) => {
  console.error('\n[scratch-live] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
