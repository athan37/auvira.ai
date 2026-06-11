import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetServerUserId = vi.fn();
const mockGetOwnerProject = vi.fn();
const mockListConversations = vi.fn();
const mockFetchHealth = vi.fn();
const mockFetchDashboardDetailed = vi.fn();
const mockFetchIntentProfileDetailed = vi.fn();
const mockFetchContextDetailed = vi.fn();
const mockIsObservabilityEnabled = vi.fn();

vi.mock('@/lib/api/projectAccess', () => ({
  getServerUserId: (...args: unknown[]) => mockGetServerUserId(...args),
  getOwnerProject: (...args: unknown[]) => mockGetOwnerProject(...args),
}));

vi.mock('@/lib/observability/client', () => ({
  listObservabilityConversations: (...args: unknown[]) => mockListConversations(...args),
  fetchObservabilityHealth: (...args: unknown[]) => mockFetchHealth(...args),
  fetchObservabilityDashboardDetailed: (...args: unknown[]) =>
    mockFetchDashboardDetailed(...args),
  fetchObservabilityIntentProfileDetailed: (...args: unknown[]) =>
    mockFetchIntentProfileDetailed(...args),
  fetchObservabilityContextDetailed: (...args: unknown[]) => mockFetchContextDetailed(...args),
}));

vi.mock('@/lib/observability/config', () => ({
  isObservabilityEnabled: () => mockIsObservabilityEnabled(),
}));

describe('GET /api/projects/[projectId]/observability/bootstrap', () => {
  const projectId = '665f4ec12f1fe71c6527f2df';

  beforeEach(() => {
    mockGetServerUserId.mockResolvedValue('user-1');
    mockGetOwnerProject.mockResolvedValue({ _id: projectId, name: 'Demo Site' });
    mockIsObservabilityEnabled.mockReturnValue(true);
    mockListConversations.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        conversations: [
          { conversation_id: `${projectId}-editor`, title: 'Editor chat', turn_count: 4 },
        ],
      },
    });
    mockFetchHealth.mockResolvedValue({
      ok: true,
      status: 200,
      data: { mongo: { ok: true }, phoenix: { enabled: true } },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns conversations and health', async () => {
    const { GET } = await import('@/app/api/projects/[projectId]/observability/bootstrap/route');
    const res = await GET(new NextRequest(`http://localhost/api/projects/${projectId}/observability/bootstrap`), {
      params: { projectId },
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.conversations).toHaveLength(1);
    expect(json.defaultConversationId).toBe(`${projectId}-editor`);
    expect(json.health?.mongo?.ok).toBe(true);
  });
});

describe('POST /api/projects/[projectId]/observability/analyze', () => {
  const projectId = '665f4ec12f1fe71c6527f2df';
  const conversationId = `${projectId}-editor`;

  beforeEach(() => {
    mockGetServerUserId.mockResolvedValue('user-1');
    mockGetOwnerProject.mockResolvedValue({ _id: projectId, name: 'Demo Site' });
    mockIsObservabilityEnabled.mockReturnValue(true);
    mockFetchDashboardDetailed.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        dashboard: {
          cards: {
            turn_count: 2,
            session_grade: 'B',
            top_issue_label: 'ambiguous section',
          },
          turns: [
            {
              turn_id: 't-1',
              turn_index: 0,
              created_at: '2026-06-09T12:00:00Z',
              user_message: 'change background to my favorite color',
              grade: 'B',
              outcome: 'success',
            },
          ],
        },
      },
    });
    mockFetchIntentProfileDetailed.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        intent: {
          keywords: ['favorite', 'color'],
          intents: ['style_background'],
          turn_count: 4,
        },
      },
    });
    mockFetchContextDetailed.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        context: {
          coaching_hints: ['Hint one'],
          missing_keywords: ['favorite'],
          quality_snapshot: { latest_grade: 'B', trend: 'stable' },
          source: 'turn_ledger',
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns session summary, intent profile, and coaching context', async () => {
    const { POST } = await import('@/app/api/projects/[projectId]/observability/analyze/route');
    const res = await POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/observability/analyze`, {
        method: 'POST',
        body: JSON.stringify({ conversationId }),
      }),
      { params: { projectId } }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.sessionSummary.turnCount).toBe(2);
    expect(json.intentProfile.keywords).toEqual(['favorite', 'color']);
    expect(json.coachingContext.parsed.missingKeywords).toEqual(['favorite']);
    expect(json.developerAnalytics.turns).toHaveLength(1);
    expect(mockFetchDashboardDetailed).toHaveBeenCalledWith(
      expect.objectContaining({ projectId, conversationId, turnLimit: 50 })
    );
  });

  it('reports dashboard 404 in errors', async () => {
    mockFetchDashboardDetailed.mockResolvedValue({
      ok: false,
      status: 404,
      data: null,
      error: 'not found',
    });
    const { POST } = await import('@/app/api/projects/[projectId]/observability/analyze/route');
    const res = await POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/observability/analyze`, {
        method: 'POST',
        body: JSON.stringify({ conversationId }),
      }),
      { params: { projectId } }
    );
    const json = await res.json();

    expect(json.errors[0].message).toBe('Conversation not found');
  });
});
