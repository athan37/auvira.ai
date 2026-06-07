/** Stable editor conversation id for Site Monitor (one per project). */
export function editorConversationId(projectId: string): string {
  return `${projectId}-editor`;
}
