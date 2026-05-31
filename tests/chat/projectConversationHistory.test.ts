import { beforeEach, describe, expect, it, vi } from 'vitest';

const findMock = vi.fn();
const connectMongoDBMock = vi.fn();

vi.mock('../../src/lib/mongodb', () => ({
  connectMongoDB: connectMongoDBMock,
}));

vi.mock('../../src/models/ProjectMessage', () => ({
  ProjectMessage: {
    find: findMock,
    create: vi.fn(),
  },
}));

function mockFindResult(result: unknown[]) {
  const lean = vi.fn().mockResolvedValue(result);
  const limit = vi.fn().mockReturnValue({ lean });
  const sort = vi.fn().mockReturnValue({ limit, lean });
  const select = vi.fn().mockReturnValue({ sort, limit, lean });
  findMock.mockReturnValue({ select, sort, limit, lean });
}

describe('projectChatService conversation history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns normalized last turns in chronological order', async () => {
    mockFindResult([
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'first' },
    ]);

    const svc = await import('../../src/lib/chat/projectChatService');
    const history = await svc.buildConversationHistory({
      projectId: '665f4ec12f1fe71c6527f2df',
      maxTurns: 2,
    });

    expect(connectMongoDBMock).toHaveBeenCalledTimes(1);
    expect(history).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
    ]);
  });

  it('maps API list payload including error flags', async () => {
    mockFindResult([
      {
        role: 'assistant',
        content: 'Failed to apply',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        metadata: {
          outcome: 'failure',
          editJobId: 'job-1',
          errorStage: 'agent_failed',
          attachments: [{ previewUrl: 'https://cdn.example.com/x.jpg' }],
        },
      },
    ]);

    const svc = await import('../../src/lib/chat/projectChatService');
    const rows = await svc.listProjectMessages({
      projectId: '665f4ec12f1fe71c6527f2df',
      limit: 10,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.isError).toBe(true);
    expect(rows[0]?.errorJobId).toBe('job-1');
    expect(rows[0]?.imagePreviews).toEqual(['https://cdn.example.com/x.jpg']);
  });

  it('resolveEditFocusFromProject reads editFocusStack metadata', async () => {
    mockFindResult([
      {
        metadata: {
          editFocusStack: {
            items: [
              {
                kind: 'section_created',
                sectionIndex: 2,
                sectionTitle: 'Winter Portfolio',
                imageUrls: ['/uploads/a.png'],
                imageCount: 1,
                at: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        },
      },
    ]);

    const svc = await import('../../src/lib/chat/projectChatService');
    const stack = await svc.resolveEditFocusFromProject({
      projectId: '665f4ec12f1fe71c6527f2df',
    });

    expect(stack.items).toHaveLength(1);
    expect(stack.items[0]?.sectionIndex).toBe(2);
    expect(stack.items[0]?.sectionTitle).toBe('Winter Portfolio');
  });

  it('resolveEditFocusFromProject bootstraps from lastGalleryEdit when stack missing', async () => {
    mockFindResult([
      {
        metadata: {
          lastGalleryEdit: {
            sectionIndex: 3,
            title: 'Showcase',
            imageUrls: ['/uploads/x.png'],
            imageCount: 1,
          },
        },
      },
    ]);

    const svc = await import('../../src/lib/chat/projectChatService');
    const stack = await svc.resolveEditFocusFromProject({
      projectId: '665f4ec12f1fe71c6527f2df',
    });

    expect(stack.items[0]?.kind).toBe('section_created');
    expect(stack.items[0]?.sectionIndex).toBe(3);
  });
});
