export interface CloneBuildPreviewResponse {
  projectId?: unknown;
}

/** Builds the project editor path from the build-preview response when auto-handoff succeeds. */
export function getClonePreviewProjectPath(data: CloneBuildPreviewResponse): string | null {
  if (typeof data.projectId !== 'string') return null;
  const projectId = data.projectId.trim();
  if (!projectId) return null;
  return `/projects/${encodeURIComponent(projectId)}`;
}
