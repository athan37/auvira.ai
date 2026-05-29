import type { IWebsiteProject } from '@/models/WebsiteProject';
import {
  forcePublishWorkspaceToGitLab,
  publishWorkspaceToGitLab,
} from '@/lib/gitlab/publishWorkspace';
import { getGitWorkspacePath, hasUncommittedChanges } from '@/lib/project-workspace/gitWorkspaceManager';
import {
  publishSandboxWorkspaceToGitLab,
  sandboxHasUncommittedChanges,
} from '@/lib/sandbox/publishSandboxWorkspace';
import { isSandboxPreviewEnabled } from '@/lib/runtime/isSandboxPreviewEnabled';
import {
  repairSiteConfigTypesInWorkspace,
  repairSiteConfigTypesViaGateway,
} from '@/lib/preview/repairSiteConfigTypes';
import { getSandboxGateway } from '@/lib/sandbox/sandboxWorkspaceGateway';
import { sanitizeAgentMarkerFilesInWorkspace } from '@/lib/site-manager/siteConfigAgentMarkers';
import { instrumentGeneratedSite } from '@/lib/analytics/generated-sites/instrumentGeneratedSite';
import {
  deploymentOrigins,
  ensureWebsiteAnalyticsConfig,
} from '@/lib/analytics/config/websiteAnalyticsConfigService';

export type CommitWorkspaceResult = {
  commitSha: string;
  pushed: boolean;
  changedFiles: number;
};

export type SyncWorkspaceResult = CommitWorkspaceResult & {
  synced: boolean;
};

export type SaveWorkspaceResult = CommitWorkspaceResult & {
  /** How the save was applied — surfaced in UI copy only. */
  mode: 'incremental' | 'force';
};

async function instrumentAnalyticsBeforePublish(
  project: IWebsiteProject,
  projectId: string,
  options: {
    workspacePath: string;
    gateway?: import('@/lib/project-workspace/workspaceGateway').WorkspaceGateway;
  }
): Promise<void> {
  try {
    const config = await ensureWebsiteAnalyticsConfig({
      project,
      allowedOrigins: deploymentOrigins(project),
    });
    await instrumentGeneratedSite({
      workspacePath: options.workspacePath,
      gateway: options.gateway,
      publicSiteKey: config.publicSiteKey,
    });
  } catch (error) {
    console.warn(
      `[analytics] Passive instrumentation skipped before publish: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
  }
}

/**
 * Commit local workspace changes to the linked GitLab repository.
 */
export async function commitWorkspaceToGitLab(
  project: IWebsiteProject,
  projectId: string,
  commitMessage?: string
): Promise<CommitWorkspaceResult> {
  const source = project.codeWorkspace?.source || 'generated';

  if (source !== 'gitlab') {
    throw new Error('Only GitLab-linked workspaces can be saved.');
  }

  if (!project.gitlab?.projectId) {
    throw new Error('No GitLab project linked to this project.');
  }

  if (!project.codeWorkspace || project.codeWorkspace.status !== 'ready') {
    throw new Error('Code workspace not ready.');
  }

  const useSandbox = isSandboxPreviewEnabled() && Boolean(project.gitlab?.projectId);
  if (useSandbox) {
    try {
      const gateway = await getSandboxGateway(projectId);
      await repairSiteConfigTypesViaGateway(gateway);
      await sanitizeAgentMarkerFilesInWorkspace('', {
        read: (rel) => gateway.readFile(rel).catch(() => null),
        write: (rel, content) => gateway.writeFile(rel, content),
      });
      await instrumentAnalyticsBeforePublish(project, projectId, {
        workspacePath: gateway.getWorkspacePath(),
        gateway,
      });
    } catch {
      /* non-fatal */
    }
  } else {
    const workspacePath = getGitWorkspacePath(projectId);
    await repairSiteConfigTypesInWorkspace(workspacePath).catch(() => {});
    await sanitizeAgentMarkerFilesInWorkspace(workspacePath).catch(() => {});
    await instrumentAnalyticsBeforePublish(project, projectId, { workspacePath });
  }
  const result = useSandbox
    ? await publishSandboxWorkspaceToGitLab({
        project,
        projectId,
        commitMessage:
          commitMessage ||
          project.codeWorkspace.lastEditSummary ||
          'Website updates from code editor',
        branch: project.gitlab.defaultBranch || 'main',
      })
    : await publishWorkspaceToGitLab({
        workspacePath: getGitWorkspacePath(projectId),
        gitlabProjectId: project.gitlab.projectId,
        branch: project.gitlab.defaultBranch || 'main',
        commitMessage:
          commitMessage ||
          project.codeWorkspace.lastEditSummary ||
          'Website updates from code editor',
      });

  return {
    commitSha: result.commitSha,
    pushed: result.published,
    changedFiles: result.changedFiles.length,
  };
}

/**
 * Push local preview changes to GitLab when the workspace has uncommitted edits.
 * Returns synced=false when GitLab already matches local files.
 */
export async function syncWorkspaceToGitLabIfDirty(
  project: IWebsiteProject,
  projectId: string,
  commitMessage?: string
): Promise<SyncWorkspaceResult> {
  const dirty =
    isSandboxPreviewEnabled() && project.gitlab?.projectId
      ? await sandboxHasUncommittedChanges(projectId)
      : await hasUncommittedChanges(projectId);
  if (!dirty) {
    return {
      synced: false,
      commitSha: project.gitlab?.lastCommitSha || '',
      pushed: false,
      changedFiles: 0,
    };
  }

  const result = await commitWorkspaceToGitLab(project, projectId, commitMessage);
  return { synced: true, ...result };
}

/**
 * Push every publishable file from the local workspace to GitLab, regardless of git status.
 */
export async function forceSyncWorkspaceToGitLab(
  project: IWebsiteProject,
  projectId: string,
  commitMessage?: string
): Promise<CommitWorkspaceResult> {
  const source = project.codeWorkspace?.source || 'generated';

  if (source !== 'gitlab') {
    throw new Error('Only GitLab-linked workspaces can be synced.');
  }

  if (!project.gitlab?.projectId) {
    throw new Error('No GitLab project linked to this project.');
  }

  if (!project.codeWorkspace || project.codeWorkspace.status !== 'ready') {
    throw new Error('Code workspace not ready.');
  }

  if (isSandboxPreviewEnabled() && project.gitlab?.projectId) {
    try {
      const gateway = await getSandboxGateway(projectId);
      await instrumentAnalyticsBeforePublish(project, projectId, {
        workspacePath: gateway.getWorkspacePath(),
        gateway,
      });
    } catch {
      /* non-fatal */
    }
    const result = await publishSandboxWorkspaceToGitLab({
      project,
      projectId,
      commitMessage: commitMessage || 'Force sync: local preview to GitLab',
      branch: project.gitlab.defaultBranch || 'main',
    });
    return {
      commitSha: result.commitSha,
      pushed: result.published,
      changedFiles: result.changedFiles.length,
    };
  }

  const workspacePath = getGitWorkspacePath(projectId);
  await instrumentAnalyticsBeforePublish(project, projectId, { workspacePath });
  const result = await forcePublishWorkspaceToGitLab({
    workspacePath,
    gitlabProjectId: project.gitlab.projectId,
    branch: project.gitlab.defaultBranch || 'main',
    commitMessage: commitMessage || 'Force sync: local preview to GitLab',
  });

  return {
    commitSha: result.commitSha,
    pushed: result.published,
    changedFiles: result.changedFiles.length,
  };
}

function isNoChangesError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('No changes to commit') ||
    msg.includes('No publishable file changes')
  );
}

/**
 * Save local preview to GitLab. Uses git-detected changes when possible; falls back to
 * a full workspace sync when git has nothing to commit but the project still has edits.
 */
export async function saveWorkspaceToGitLab(
  project: IWebsiteProject,
  projectId: string,
  options?: { force?: boolean; commitMessage?: string }
): Promise<SaveWorkspaceResult> {
  const commitMessage = options?.commitMessage;

  if (options?.force) {
    const result = await forceSyncWorkspaceToGitLab(project, projectId, commitMessage);
    return { ...result, mode: 'force' };
  }

  try {
    const result = await commitWorkspaceToGitLab(project, projectId, commitMessage);
    return { ...result, mode: 'incremental' };
  } catch (error) {
    const shouldForce =
      isNoChangesError(error) &&
      (project.hasUnpublishedChanges ||
        project.codeWorkspace?.lastValidationStatus === 'failed');

    if (!shouldForce) {
      throw error;
    }

    const result = await forceSyncWorkspaceToGitLab(
      project,
      projectId,
      commitMessage || 'Save: sync local preview to GitLab'
    );
    return { ...result, mode: 'force' };
  }
}
