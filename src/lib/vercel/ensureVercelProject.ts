import { generateUniqueProjectName } from '@/lib/clone/persistClonePreview';
import type { IDeploymentInfo, IWebsiteProject } from '@/models/WebsiteProject';
import { createVercelProject } from './createVercelProject';
import { hasVercelApiToken } from './vercelEnv';
import type { VercelDeploymentResult } from './types';

export function vercelResultToDeploymentInfo(
  vercelResult: VercelDeploymentResult
): IDeploymentInfo {
  return {
    provider: vercelResult.provider,
    status: vercelResult.status,
    ready: false,
    projectId: vercelResult.projectId,
    projectUrl: vercelResult.projectUrl,
    vercelProjectName: vercelResult.vercelProjectName,
    deployHookCreated: vercelResult.deployHookCreated,
    deployTriggered: vercelResult.deployTriggered,
    deployHookId: vercelResult.deployHookId,
    deployHookUrl: vercelResult.deployHookUrl,
    triggeredAt: vercelResult.triggeredAt,
    expectedProductionUrl: vercelResult.expectedProductionUrl,
    liveUrl: null,
    deploymentUrl: null,
    inspectorUrl: null,
    note: vercelResult.note,
    error: vercelResult.error,
  };
}

export type EnsureVercelProjectResult = {
  deployment: IDeploymentInfo | null;
  created: boolean;
};

/**
 * Ensure a WebsiteProject has a linked Vercel project. Creates one on first call
 * when SITE_AGENT_VERCEL_TOKEN is configured and GitLab is linked.
 */
export async function ensureVercelProjectLinked(
  project: Pick<IWebsiteProject, 'name' | 'deployment' | 'gitlab'>
): Promise<EnsureVercelProjectResult> {
  if (project.deployment?.projectId) {
    return { deployment: project.deployment, created: false };
  }

  if (!hasVercelApiToken()) {
    console.warn('[ensureVercel] SITE_AGENT_VERCEL_TOKEN not set — skipping Vercel link');
    return { deployment: project.deployment ?? null, created: false };
  }

  const gitlabProjectId = project.gitlab?.projectId;
  const repoUrl = project.gitlab?.httpUrlToRepo || project.gitlab?.repoUrl;
  if (!gitlabProjectId || !repoUrl) {
    console.warn('[ensureVercel] GitLab project not linked — skipping Vercel link');
    return { deployment: project.deployment ?? null, created: false };
  }

  const vercelName = generateUniqueProjectName(project.name || 'website');
  console.log(`[ensureVercel] Creating Vercel project for GitLab repo ${gitlabProjectId}`);

  const vercelResult = await createVercelProject({
    name: vercelName,
    gitlabProjectId,
    gitlabRepoUrl: repoUrl,
    gitlabPathWithNamespace: project.gitlab?.pathWithNamespace,
  });

  return {
    deployment: vercelResultToDeploymentInfo(vercelResult),
    created: true,
  };
}
