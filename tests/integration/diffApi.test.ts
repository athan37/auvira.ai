import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetOwnerProject = vi.fn();
const mockGetLatestEditJob = vi.fn();

vi.mock('@/lib/api/projectAccess', () => ({
  getOwnerProject: (...args: unknown[]) => mockGetOwnerProject(...args),
}));

vi.mock('@/lib/project-workspace/editJobLogger', () => ({
  getLatestEditJob: (...args: unknown[]) => mockGetLatestEditJob(...args),
}));

describe('GET /code-agent/diff (integration)', () => {
  const projectId = '6a135ba264e7672599597ea1';
  const jobId = '6a13e305e47706cf035c18f1';

  beforeEach(() => {
    mockGetOwnerProject.mockResolvedValue({ _id: projectId, ownerId: 'user-1' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns job details when jobId matches project', async () => {
    mockGetLatestEditJob.mockResolvedValue({
      _id: { toString: () => jobId },
      status: 'failed',
      changedFiles: [{ path: 'src/app/page.tsx', status: 'modified' }],
      summary: null,
      error: "I couldn't apply that change. Please try again.",
      buildLog: null,
      logs: [{ type: 'agent_finished', message: 'Agent failed', createdAt: new Date() }],
      prompt: 'Change the hero headline',
    });

    const { GET } = await import('@/app/api/projects/[projectId]/code-agent/diff/route');
    const res = await GET(
      new NextRequest(
        `http://localhost/api/projects/${projectId}/code-agent/diff?jobId=${jobId}`
      ),
      { params: { projectId } }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.jobId).toBe(jobId);
    expect(json.status).toBe('failed');
    expect(json.changedFiles).toHaveLength(1);
    expect(json.error).toMatch(/couldn't apply/i);
  });

  it('returns null jobId with message when job not found', async () => {
    mockGetLatestEditJob.mockResolvedValue(null);

    const { GET } = await import('@/app/api/projects/[projectId]/code-agent/diff/route');
    const res = await GET(
      new NextRequest(
        `http://localhost/api/projects/${projectId}/code-agent/diff?jobId=missing`
      ),
      { params: { projectId } }
    );
    const json = await res.json();

    expect(json.jobId).toBeNull();
    expect(json.error).toMatch(/not found/i);
  });

  it('returns 404 when project not owned', async () => {
    mockGetOwnerProject.mockResolvedValue(null);
    const { GET } = await import('@/app/api/projects/[projectId]/code-agent/diff/route');

    const res = await GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/code-agent/diff`),
      { params: { projectId } }
    );
    expect(res.status).toBe(404);
  });
});
