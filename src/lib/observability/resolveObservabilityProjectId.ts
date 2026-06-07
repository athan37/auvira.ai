/** Monitor project_id for a clone job before WebsiteProject handoff. */
export function cloneJobObservabilityProjectId(jobId: string): string {
  return `clone-${jobId}`;
}

/** Monitor project_id for scratch/generate flows. */
export function scratchObservabilityProjectId(sessionId: string): string {
  return `scratch-${sessionId}`;
}

/**
 * Resolve Monitor project_id for clone flows: prefer real WebsiteProject id when set.
 */
export function resolveCloneObservabilityProjectId(input: {
  jobId: string;
  createdProjectId?: string | null;
}): string {
  const created = input.createdProjectId?.trim();
  if (created) return created;
  return cloneJobObservabilityProjectId(input.jobId);
}
