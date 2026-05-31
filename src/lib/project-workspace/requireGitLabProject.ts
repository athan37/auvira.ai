/** Owner-facing message when a project cannot use V3 edits (legacy/V2 workspace). */
export const LEGACY_PROJECT_UNSUPPORTED_MESSAGE =
  'This project uses a legacy workspace and is no longer supported. Create a new site from scratch or clone.';

type ProjectLike = {
  gitlab?: {
    repoUrl?: string | null;
    projectId?: number | null;
    httpUrlToRepo?: string | null;
  } | null;
  editingMode?: string | null;
  codeWorkspace?: {
    workspacePath?: string | null;
    source?: string | null;
    [key: string]: unknown;
  } | null;
};

/** Why a project is blocked from V3 edits (null = supported). */
export type UnsupportedProjectReason =
  | 'missing_gitlab'
  | 'incomplete_gitlab'
  | 'spec_editing_mode'
  | 'static_workspace_path';

const REASON_LABELS: Record<UnsupportedProjectReason, string> = {
  missing_gitlab: 'no GitLab repo (V1/static)',
  incomplete_gitlab: 'incomplete GitLab record',
  spec_editing_mode: 'spec editing mode (V2)',
  static_workspace_path: 'static HTML workspace path (V2)',
};

/** Human-readable label for purge dry-run output. */
export function unsupportedProjectReasonLabel(reason: UnsupportedProjectReason): string {
  return REASON_LABELS[reason];
}

/** True when the project has a GitLab repo URL (necessary but not sufficient for V3). */
export function projectHasGitLabRepo(project: ProjectLike): boolean {
  return Boolean(project.gitlab?.repoUrl?.trim());
}

/**
 * Returns why V3 edits are unsupported, or null when the project is valid.
 */
export function getUnsupportedProjectReason(project: ProjectLike): UnsupportedProjectReason | null {
  if (!projectHasGitLabRepo(project)) {
    return 'missing_gitlab';
  }

  const gitlab = project.gitlab!;
  if (!gitlab.projectId || !gitlab.httpUrlToRepo?.trim()) {
    return 'incomplete_gitlab';
  }

  if (project.editingMode === 'spec') {
    return 'spec_editing_mode';
  }

  const workspacePath = project.codeWorkspace?.workspacePath ?? '';
  if (workspacePath.includes('project-workspaces')) {
    return 'static_workspace_path';
  }

  return null;
}

/** True when chat edits and uploads may use the V3 GitLab pipeline. */
export function projectSupportsV3Edits(project: ProjectLike): boolean {
  return getUnsupportedProjectReason(project) === null;
}
