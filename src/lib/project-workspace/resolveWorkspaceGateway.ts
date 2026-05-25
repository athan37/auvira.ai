import type { IWebsiteProject } from '@/models/WebsiteProject';
import { isSandboxPreviewEnabled } from '@/lib/runtime/isSandboxPreviewEnabled';
import { ensureProjectSandboxForEdit } from '@/lib/sandbox/bootstrapProjectSandbox';
import { getSandboxGateway } from '@/lib/sandbox/sandboxWorkspaceGateway';
import { SANDBOX_WORKDIR } from '@/lib/sandbox/types';
import { ensureGitWorkspace } from './gitWorkspaceManager';
import { LocalFsGateway, type WorkspaceGateway } from './workspaceGateway';

export interface ResolvedWorkspace {
  gateway: WorkspaceGateway;
  workspacePath: string;
  source: 'gitlab' | 'generated';
  mode: 'gitlab' | 'static';
  sandbox: boolean;
}

/**
 * Resolve the workspace gateway for edits (local scratch or Vercel Sandbox).
 */
export async function resolveWorkspaceForEdit(
  project: IWebsiteProject,
  userId: string
): Promise<ResolvedWorkspace> {
  const useSandbox = isSandboxPreviewEnabled() && Boolean(project.gitlab?.repoUrl);

  if (useSandbox) {
    await ensureProjectSandboxForEdit(project, userId);
    const gateway = await getSandboxGateway(project._id.toString());
    return {
      gateway,
      workspacePath: SANDBOX_WORKDIR,
      source: 'gitlab',
      mode: 'gitlab',
      sandbox: true,
    };
  }

  if (project.gitlab?.repoUrl) {
    const gitInfo = await ensureGitWorkspace(project, userId);
    return {
      gateway: new LocalFsGateway(gitInfo.workspacePath),
      workspacePath: gitInfo.workspacePath,
      source: 'gitlab',
      mode: 'gitlab',
      sandbox: false,
    };
  }

  throw new Error('No GitLab workspace for this project');
}
