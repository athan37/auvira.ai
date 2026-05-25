import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import {
  getScratchTtlMs,
  projectScratchDirs,
  pruneExpiredScratch,
  releaseProjectScratch,
} from '../src/lib/runtime/scratchCleanup';
import { getScratchRoot } from '../src/lib/runtime/scratchDir';

describe('scratchCleanup', () => {
  const prevEnv: Record<string, string | undefined> = {};
  let scratchRoot = '';

  beforeEach(async () => {
    prevEnv.SITE_AGENT_SCRATCH_DIR = process.env.SITE_AGENT_SCRATCH_DIR;
    prevEnv.SITE_AGENT_SCRATCH_TTL_MS = process.env.SITE_AGENT_SCRATCH_TTL_MS;
    scratchRoot = path.join(
      await fs.mkdtemp(path.join(process.cwd(), 'scratch-cleanup-test-'))
    );
    process.env.SITE_AGENT_SCRATCH_DIR = scratchRoot;
    process.env.SITE_AGENT_SCRATCH_TTL_MS = '1000';
  });

  afterEach(async () => {
    if (prevEnv.SITE_AGENT_SCRATCH_DIR === undefined) {
      delete process.env.SITE_AGENT_SCRATCH_DIR;
    } else {
      process.env.SITE_AGENT_SCRATCH_DIR = prevEnv.SITE_AGENT_SCRATCH_DIR;
    }
    if (prevEnv.SITE_AGENT_SCRATCH_TTL_MS === undefined) {
      delete process.env.SITE_AGENT_SCRATCH_TTL_MS;
    } else {
      process.env.SITE_AGENT_SCRATCH_TTL_MS = prevEnv.SITE_AGENT_SCRATCH_TTL_MS;
    }
    if (scratchRoot) {
      await fs.rm(scratchRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('defaults TTL to thirty minutes', () => {
    delete process.env.SITE_AGENT_SCRATCH_TTL_MS;
    expect(getScratchTtlMs()).toBe(30 * 60 * 1000);
  });

  it('releaseProjectScratch removes project dirs', async () => {
    const projectId = 'proj-release';
    for (const dir of projectScratchDirs(projectId)) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'marker.txt'), 'x');
    }

    const { removed } = await releaseProjectScratch(projectId);
    expect(removed.length).toBeGreaterThan(0);

    for (const dir of projectScratchDirs(projectId)) {
      await expect(fs.stat(dir)).rejects.toThrow();
    }
  });

  it('pruneExpiredScratch removes stale top-level project dirs', async () => {
    const stale = path.join(getScratchRoot(), 'git-workspaces', 'stale-proj');
    await fs.mkdir(stale, { recursive: true });
    const fortyMinAgo = new Date(Date.now() - 40 * 60 * 1000);
    await fs.utimes(stale, fortyMinAgo, fortyMinAgo);

    const fresh = path.join(getScratchRoot(), 'git-workspaces', 'fresh-proj');
    await fs.mkdir(fresh, { recursive: true });

    const { removed } = await pruneExpiredScratch(30 * 60 * 1000);
    expect(removed.some((p) => p.endsWith('stale-proj'))).toBe(true);
    await expect(fs.stat(stale)).rejects.toThrow();
    await expect(fs.stat(fresh)).resolves.toBeDefined();
  });
});
