import { createObservabilityConversation, createObservabilityProject } from './client';
import { editorConversationId } from './conversationId';
import { isObservabilityEnabled } from './config';

export interface ObservabilityConversationRegistration {
  conversationId: string;
  title?: string;
}

/** Idempotent register project + conversations with Site Monitor. */
export async function ensureObservabilityRegistration(input: {
  projectId: string;
  title: string;
  conversations?: ObservabilityConversationRegistration[];
}): Promise<void> {
  if (!isObservabilityEnabled()) return;

  const conversations = input.conversations ?? [
    { conversationId: editorConversationId(input.projectId), title: 'Editor chat' },
  ];

  try {
    await createObservabilityProject({
      projectId: input.projectId,
      title: input.title,
    });
    for (const conversation of conversations) {
      await createObservabilityConversation({
        projectId: input.projectId,
        conversationId: conversation.conversationId,
        title: conversation.title,
      });
    }
  } catch (error) {
    console.warn('[observability] registration failed', {
      projectId: input.projectId,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}
