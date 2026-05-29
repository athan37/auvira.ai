import type { IWebsiteProject } from '@/models/WebsiteProject';

export type InfraStatus = 'pending' | 'ready' | 'failed';

/**
 * True when project infra migration baseline is ready (v1+).
 * Edits may skip inline tailwind/page wiring repairs when this holds.
 */
export function isInfraBaselineReady(project: {
  infraStatus?: InfraStatus | string | null;
  infraVersion?: number | null;
}): boolean {
  const status = project.infraStatus;
  const version = project.infraVersion ?? 0;
  return status === 'ready' && version >= 1;
}

/** Map a loaded WebsiteProject document to infra baseline readiness. */
export function infraBaselineReadyFromProject(project: IWebsiteProject): boolean {
  return isInfraBaselineReady({
    infraStatus: project.infraStatus,
    infraVersion: project.infraVersion,
  });
}
