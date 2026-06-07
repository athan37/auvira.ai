import { describe, expect, it } from 'vitest';
import {
  cloneBuildConversationId,
  clonePreviewConversationId,
  cloneWizardConversationId,
  editorConversationId,
  generateConversationId,
} from '@/lib/observability/conversationId';
import {
  cloneJobObservabilityProjectId,
  resolveCloneObservabilityProjectId,
  scratchObservabilityProjectId,
} from '@/lib/observability/resolveObservabilityProjectId';

describe('observability conversation ids', () => {
  it('builds stable editor and clone conversation ids', () => {
    expect(editorConversationId('abc123')).toBe('abc123-editor');
    expect(cloneWizardConversationId('job1')).toBe('clone-job1-wizard');
    expect(clonePreviewConversationId('abc123')).toBe('abc123-clone-preview');
    expect(cloneBuildConversationId('abc123')).toBe('abc123-clone-build');
    expect(generateConversationId('sess')).toBe('sess-generate');
  });
});

describe('resolveCloneObservabilityProjectId', () => {
  it('prefers createdProjectId when set', () => {
    expect(
      resolveCloneObservabilityProjectId({ jobId: 'job1', createdProjectId: 'real-proj' })
    ).toBe('real-proj');
    expect(cloneJobObservabilityProjectId('job1')).toBe('clone-job1');
    expect(scratchObservabilityProjectId('u1')).toBe('scratch-u1');
  });
});
