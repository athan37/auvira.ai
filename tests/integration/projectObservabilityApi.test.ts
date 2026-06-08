import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetServerUserId = vi.fn();
const mockGetOwnerProject = vi.fn();
const mockAggregateProject = vi.fn();
const mockFetchContextRaw = vi.fn();
const mockIsObservabilityEnabled = vi.fn();

vi.mock('@/lib/api/projectAccess', () => ({
  getServerUserId: (...args: unknown[]) => mockGetServerUserId(...args),
  getOwnerProject: (...args: unknown[]) => mockGetOwnerProject(...args),
}));

vi.mock('@/lib/metrics/aggregateObservabilityMetrics', () => ({
  aggregateProjectObservabilityMetrics: (...args: unknown[]) => mockAggregateProject(...args),
}));

vi.mock('@/lib/observability/client', () => ({
  fetchObservabilityContextRaw: (...args: unknown[]) => mockFetchContextRaw(...args),
}));

vi.mock('@/lib/observability/config', () => ({
  isObservabilityEnabled: () => mockIsObservabilityEnabled(),
}));

describe('GET /api/projects/[projectId]/observability', () => {
  const projectId = '665f4ec12f1fe71c6527f2df';

  beforeEach(() => {
    mockGetServerUserId.mockResolvedValue('user-1');
    mockGetOwnerProject.mockResolvedValue({ _id: projectId, name: 'Demo Site' });
    mockIsObservabilityEnabled.mockReturnValue(true);
    mockAggregateProject.mockResolvedValue({
      summary: {
        syncedCount: 1,
        failedSyncCount: 0,
        averageScore: 0.9,
        gradeCounts: { A: 1 },
        outcomeCounts: { success: 1, clarification: 0, failure: 0 },
        coachingAppliedCount: 0,
        clarificationCount: 0,
      },
      turns: [],
    });
    mockFetchContextRaw.mockResolvedValue({
      context: {
        coaching_hints: ['Hint one'],
        recurring_issues: ['ambiguous section'],
        source: 'phoenix_traces',
        trace_count: 5,
        quality_snapshot: { grade: 'B', score: 0.85 },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetServerUserId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/projects/[projectId]/observability/route');

    const res = await GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/observability`),
      { params: { projectId } }
    );

    expect(res.status).toBe(401);
  });

  it('returns 404 when project is not owned', async () => {
    mockGetOwnerProject.mockResolvedValue(null);
    const { GET } = await import('@/app/api/projects/[projectId]/observability/route');

    const res = await GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/observability`),
      { params: { projectId } }
    );

    expect(res.status).toBe(404);
  });

  it('returns 200 with summary, turns, and live context for owner', async () => {
    const { GET } = await import('@/app/api/projects/[projectId]/observability/route');

    const res = await GET(
      new NextRequest(
        `http://localhost/api/projects/${projectId}/observability?days=7&probeMessage=make%20hero%20red`
      ),
      { params: { projectId } }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.projectName).toBe('Demo Site');
    expect(json.summary.syncedCount).toBe(1);
    expect(json.liveContext.parsed.coachingHints).toEqual(['Hint one']);
    expect(json.liveContext.parsed.recurringIssues).toEqual(['ambiguous section']);
    expect(mockAggregateProject).toHaveBeenCalledWith({ projectId, days: 7 });
    expect(mockFetchContextRaw).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        latestUserMessage: 'make hero red',
      })
    );
  });

  it('skips live context fetch when monitor is disabled', async () => {
    mockIsObservabilityEnabled.mockReturnValue(false);
    const { GET } = await import('@/app/api/projects/[projectId]/observability/route');

    const res = await GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/observability`),
      { params: { projectId } }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.monitorEnabled).toBe(false);
    expect(json.liveContext).toBeNull();
    expect(mockFetchContextRaw).not.toHaveBeenCalled();
  });
});
