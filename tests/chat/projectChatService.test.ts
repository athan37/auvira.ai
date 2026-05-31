import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();
const findMock = vi.fn();
const connectMongoDBMock = vi.fn();

vi.mock('../../src/lib/mongodb', () => ({
  connectMongoDB: connectMongoDBMock,
}));

vi.mock('../../src/models/ProjectMessage', () => ({
  ProjectMessage: {
    create: createMock,
    find: findMock,
  },
}));

describe('projectChatService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appendUserMessage stores attachments and arize pending metadata', async () => {
    const svc = await import('../../src/lib/chat/projectChatService');
    await svc.appendUserMessage({
      projectId: '665f4ec12f1fe71c6527f2df',
      content: 'Please add this image to the hero.',
      clientMessageId: 'client-1',
      attachments: [
        {
          id: 'a1',
          path: 'uploads/a1.jpg',
          publicUrl: 'https://cdn.example.com/a1.jpg',
          previewUrl: 'https://cdn.example.com/a1.jpg',
          mimeType: 'image/jpeg',
          size: 1234,
          originalName: 'hero.jpg',
        },
      ],
    });

    expect(connectMongoDBMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledTimes(1);
    const payload = createMock.mock.calls[0]?.[0];
    expect(payload.role).toBe('user');
    expect(payload.content).toContain('Please add');
    expect(payload.metadata.clientMessageId).toBe('client-1');
    expect(payload.metadata.arize.syncStatus).toBe('pending');
    expect(payload.metadata.attachments).toHaveLength(1);
  });

  it('appendUserMessage stores selectedTarget in metadata', async () => {
    const svc = await import('../../src/lib/chat/projectChatService');
    await svc.appendUserMessage({
      projectId: '665f4ec12f1fe71c6527f2df',
      content: 'Make this section red.',
      selectedTarget: {
        kind: 'section',
        sectionId: 'section_services_services_1',
        sectionIndex: 1,
        sectionType: 'services',
        sectionTitle: 'Services',
      },
    });

    const payload = createMock.mock.calls[0]?.[0];
    expect(payload.metadata.selectedTarget?.sectionId).toBe('section_services_services_1');
    expect(payload.metadata.selectedTarget?.sectionTitle).toBe('Services');
  });

  it('appendAssistantMessage defaults arize sync status', async () => {
    const svc = await import('../../src/lib/chat/projectChatService');
    await svc.appendAssistantMessage({
      projectId: '665f4ec12f1fe71c6527f2df',
      content: 'Updated your site.',
      metadata: { outcome: 'success' },
    });

    const payload = createMock.mock.calls[0]?.[0];
    expect(payload.role).toBe('assistant');
    expect(payload.metadata.outcome).toBe('success');
    expect(payload.metadata.arize.syncStatus).toBe('pending');
  });
});
