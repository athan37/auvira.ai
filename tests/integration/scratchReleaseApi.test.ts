import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import {
  projectScratchDirs,
  releaseProjectScratch,
} from '@/lib/runtime/scratchCleanup';

const mockGetOwnerProject = vi.fn();

vi.mock('@/lib/api/projectAccess', () => ({
  getOwnerProject: (...args: unknown[]) => mockGetOwnerProject(...args),
}));

vi.mock('@/lib/preview/stopPreviewServer', () => ({
  stopPreviewServerByPort: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/runtime/isVercelServerless', () => ({
  isVercelServerless: () => false,
}));

vi.mock('@/models/WebsiteProject', () => ({
  WebsiteProject: {
    updateOne: vi.fn().mockResolvedValue({}),
  },
}));

describe('workspace release API (integration)', () => {
  let scratchRoot = '';
  const projectId = 'api-e2e-release-project';

  beforeEach(async () => {
    scratchRoot = path.join(
      await fs.mkdtemp(path.join(process.cwd(), 'scratch-api-test-'))
    );
    process.env.SITE_AGENT_SCRATCH_DIR = scratchRoot;

    for (const dir of projectScratchDirs(projectId)) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'keep.txt'), '1');
    }

    mockGetOwnerProject.mockResolvedValue({
      _id: projectId,
      preview: { port: 3999 },
    });
  });

  afterEach(async () => {
    delete process.env.SITE_AGENT_SCRATCH_DIR;
    if (scratchRoot) {
      await fs.rm(scratchRoot, { recursive: true, force: true }).catch(() => {});
    }
    vi.clearAllMocks();
  });

  it('POST /workspace/release removes project scratch for owner', async () => {
    const { POST } = await import(
      '@/app/api/projects/[projectId]/workspace/release/route'
    );

    const req = new NextRequest(`http://localhost/api/projects/${projectId}/workspace/release`, {
      method: 'POST',
    });

    const res = await POST(req, { params: { projectId } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.removed.length).toBeGreaterThanOrEqual(4);

    for (const dir of projectScratchDirs(projectId)) {
      await expect(fs.stat(dir)).rejects.toThrow();
    }
  });

  it('returns 404 when project not owned', async () => {
    mockGetOwnerProject.mockResolvedValue(null);
    const { POST } = await import(
      '@/app/api/projects/[projectId]/workspace/release/route'
    );

    const res = await POST(
      new NextRequest('http://localhost/x', { method: 'POST' }),
      { params: { projectId: 'no-such' } }
    );
    expect(res.status).toBe(404);
  });
});
