import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectMongoDBMock = vi.fn();
const findMock = vi.fn();

vi.mock('../../src/lib/mongodb', () => ({
  connectMongoDB: connectMongoDBMock,
}));

vi.mock('../../src/models/ProjectMessage', () => ({
  ProjectMessage: {
    find: findMock,
  },
}));

function chainFind(rows: unknown[]) {
  const lean = vi.fn().mockResolvedValue(rows);
  const select = vi.fn().mockReturnValue({ lean });
  const limit = vi.fn().mockReturnValue({ select });
  const sort = vi.fn().mockReturnValue({ limit });
  findMock.mockReturnValue({ sort });
  return { sort, limit, select, lean };
}

describe('aggregateProjectObservabilityMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters by projectId and computes outcomeCounts', async () => {
    const createdAt = new Date('2026-06-01T12:00:00Z');
    chainFind([
      {
        createdAt,
        content: 'Updated the hero section background to red.',
        metadata: {
          outcome: 'success',
          changedFiles: ['src/app/page.tsx'],
          arize: {
            syncStatus: 'synced',
            externalId: 'trace-abc',
            grade: 'B',
            overallScore: 0.85,
          },
          observability: {
            coachingApplied: true,
            coachingHints: ['Use section index when ambiguous'],
            experimentVariant: 'control',
          },
        },
      },
      {
        createdAt: new Date('2026-06-02T12:00:00Z'),
        content: 'Which section did you mean?',
        metadata: {
          outcome: 'clarification',
          guidanceHints: ['Pick a section from the preview'],
          arize: {
            syncStatus: 'synced',
            grade: 'C',
            overallScore: 0.6,
          },
          observability: { coachingApplied: false },
        },
      },
      {
        createdAt: new Date('2026-06-03T12:00:00Z'),
        content: 'Edit failed.',
        metadata: {
          outcome: 'failure',
          arize: { syncStatus: 'failed' },
        },
      },
    ]);

    const { aggregateProjectObservabilityMetrics } = await import(
      '../../src/lib/metrics/aggregateObservabilityMetrics'
    );

    const result = await aggregateProjectObservabilityMetrics({
      projectId: '665f4ec12f1fe71c6527f2df',
      days: 7,
    });

    expect(connectMongoDBMock).toHaveBeenCalledTimes(1);
    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: '665f4ec12f1fe71c6527f2df',
        role: 'assistant',
        'metadata.arize': { $exists: true },
      })
    );

    expect(result.summary.syncedCount).toBe(2);
    expect(result.summary.failedSyncCount).toBe(1);
    expect(result.summary.coachingAppliedCount).toBe(1);
    expect(result.summary.clarificationCount).toBe(1);
    expect(result.summary.outcomeCounts).toEqual({
      success: 1,
      clarification: 1,
      failure: 1,
    });
    expect(result.summary.averageScore).toBeCloseTo(0.725, 2);
    expect(result.summary.gradeCounts).toEqual({ B: 1, C: 1 });

    expect(result.turns).toHaveLength(3);
    expect(result.turns[0]?.grade).toBe('B');
    expect(result.turns[0]?.changedFilesCount).toBe(1);
    expect(result.turns[0]?.coachingHints).toEqual(['Use section index when ambiguous']);
    expect(result.turns[1]?.guidanceHints).toEqual(['Pick a section from the preview']);
    expect(result.turns[0]?.replyPreview).toContain('Updated the hero');
  });

  it('returns empty summary when no traced turns exist', async () => {
    chainFind([]);

    const { aggregateProjectObservabilityMetrics } = await import(
      '../../src/lib/metrics/aggregateObservabilityMetrics'
    );

    const result = await aggregateProjectObservabilityMetrics({
      projectId: '665f4ec12f1fe71c6527f2df',
    });

    expect(result.turns).toEqual([]);
    expect(result.summary.averageScore).toBeNull();
    expect(result.summary.syncedCount).toBe(0);
  });
});
