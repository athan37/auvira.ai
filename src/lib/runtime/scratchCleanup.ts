import { promises as fs } from 'fs';
import path from 'path';
import { getScratchRoot, scratchPath } from '@/lib/runtime/scratchDir';

/** Per-project scratch folders (excludes shared preview-runtime cache). */
export const PROJECT_SCRATCH_PREFIXES = [
  'git-workspaces',
  'edit-snapshots',
  'project-workspaces',
  'project-previews',
  'project-deploy',
] as const;

/** Ephemeral build dirs (job id or generated name), pruned by TTL only. */
const EPHEMERAL_PREFIXES = ['generated-sites'] as const;

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function getScratchTtlMs(): number {
  const raw = process.env.SITE_AGENT_SCRATCH_TTL_MS?.trim();
  if (!raw) return DEFAULT_TTL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MS;
}

function isUnderScratchRoot(target: string): boolean {
  const root = path.resolve(getScratchRoot());
  const resolved = path.resolve(target);
  return resolved === root || resolved.startsWith(root + path.sep);
}

async function safeRemoveDir(dirPath: string): Promise<boolean> {
  if (!isUnderScratchRoot(dirPath)) {
    console.warn('[scratch-cleanup] refused path outside scratch root:', dirPath);
    return false;
  }
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return false;
    console.warn('[scratch-cleanup] remove failed:', dirPath, err);
    return false;
  }
}

async function dirAgeMs(dirPath: string): Promise<number | null> {
  try {
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) return null;
    return Date.now() - stat.mtimeMs;
  } catch {
    return null;
  }
}

/** Paths for one project's scratch data. */
export function projectScratchDirs(projectId: string): string[] {
  return PROJECT_SCRATCH_PREFIXES.map((prefix) => scratchPath(prefix, projectId));
}

/**
 * Remove on-disk scratch for a project (e.g. when owner leaves the editor).
 */
export async function releaseProjectScratch(projectId: string): Promise<{ removed: string[] }> {
  const removed: string[] = [];
  for (const dir of projectScratchDirs(projectId)) {
    if (await safeRemoveDir(dir)) {
      removed.push(dir);
    }
  }
  return { removed };
}

async function pruneChildrenInDir(
  parentDir: string,
  ttlMs: number,
  removed: string[]
): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(parentDir);
  } catch {
    return;
  }

  for (const name of entries) {
    const child = path.join(parentDir, name);
    if (!isUnderScratchRoot(child)) continue;

    const age = await dirAgeMs(child);
    if (age === null) continue;

    if (age >= ttlMs) {
      if (await safeRemoveDir(child)) {
        removed.push(child);
      }
      continue;
    }

    // Nested timestamps: edit-snapshots/{projectId}/{ts}, project-workspaces/{id}/snapshots/{ts}
    let nested: string[];
    try {
      const st = await fs.stat(child);
      if (!st.isDirectory()) continue;
      nested = await fs.readdir(child);
    } catch {
      continue;
    }

    for (const sub of nested) {
      const subPath = path.join(child, sub);
      if (!isUnderScratchRoot(subPath)) continue;
      const subAge = await dirAgeMs(subPath);
      if (subAge !== null && subAge >= ttlMs && (await safeRemoveDir(subPath))) {
        removed.push(subPath);
      }
    }
  }
}

/**
 * Delete scratch directories older than TTL (default 30 minutes).
 * Skips shared preview-runtime.
 */
export async function pruneExpiredScratch(ttlMs = getScratchTtlMs()): Promise<{ removed: string[] }> {
  const removed: string[] = [];
  const root = getScratchRoot();

  for (const prefix of [...PROJECT_SCRATCH_PREFIXES, ...EPHEMERAL_PREFIXES]) {
    await pruneChildrenInDir(path.join(root, prefix), ttlMs, removed);
  }

  if (removed.length > 0) {
    console.log(`[scratch-cleanup] pruned ${removed.length} path(s) (ttl=${ttlMs}ms)`);
  }

  return { removed };
}
