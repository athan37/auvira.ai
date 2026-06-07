import { createObservabilityConversation, createObservabilityProject } from './client';
import { editorConversationId } from './conversationId';
import { isObservabilityEnabled } from './config';

/** Idempotent register project + editor conversation with Site Monitor. */
export async function ensureObservabilityRegistration(input: {
  projectId: string;
  title: string;
}): Promise<void> {
  if (!isObservabilityEnabled()) return;

  try {
    await createObservabilityProject({
      projectId: input.projectId,
      title: input.title,
    });
    await createObservabilityConversation({
      projectId: input.projectId,
      conversationId: editorConversationId(input.projectId),
      title: 'Editor chat',
    });
  } catch (error) {
    console.warn('[observability] registration failed', {
      projectId: input.projectId,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}
