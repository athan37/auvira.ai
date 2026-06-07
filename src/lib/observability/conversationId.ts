/** Stable editor conversation id for Site Monitor (one per project). */
export function editorConversationId(projectId: string): string {
  return `${projectId}-editor`;
}

/** Clone wizard conversation (process, revise-plan) before/alongside project handoff. */
export function cloneWizardConversationId(jobId: string): string {
  return `clone-${jobId}-wizard`;
}

/** Clone preview-chat conversation after WebsiteProject exists. */
export function clonePreviewConversationId(projectId: string): string {
  return `${projectId}-clone-preview`;
}

/** Clone build-preview conversation after WebsiteProject exists. */
export function cloneBuildConversationId(projectId: string): string {
  return `${projectId}-clone-build`;
}

/** Scratch / generate flow conversation. */
export function generateConversationId(sessionId: string): string {
  return `${sessionId}-generate`;
}
