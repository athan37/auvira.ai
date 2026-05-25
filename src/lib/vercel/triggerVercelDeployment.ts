import { waitForGitLabCommit } from '@/lib/gitlab/waitForGitLabCommit';
import { VercelClient } from './vercelClient';
import { triggerVercelRedeploy } from './triggerRedeploy';

export type TriggerVercelDeploymentInput = {
  vercelProjectId: string;
  vercelProjectName: string;
  gitlabProjectId: number;
  gitlabPathWithNamespace?: string;
  commitSha: string;
  branch?: string;
  /** When true, fall back to deploy hook if SHA-pinned API deploy fails. Default false. */
  allowUnpinnedFallback?: boolean;
};

export type TriggerVercelDeploymentResult = {
  deployTriggered: boolean;
  deployHookId?: string;
  method?: 'api-sha' | 'deploy-hook';
  deploymentId?: string;
  error?: string;
};

/**
 * Deploy a specific GitLab commit to Vercel. Waits for GitLab propagation, then
 * creates a deployment pinned to that SHA.
 */
export async function triggerVercelDeployment(
  input: TriggerVercelDeploymentInput
): Promise<TriggerVercelDeploymentResult> {
  const branch = input.branch || 'main';
  const { vercelProjectId, vercelProjectName, gitlabProjectId, commitSha } = input;

  await waitForGitLabCommit(gitlabProjectId, commitSha, { branch });
  console.log(`[Vercel] GitLab commit ${commitSha.slice(0, 8)} visible on ${branch}`);

  const client = new VercelClient();
  const project = vercelProjectId;

  const gitSourceVariants: Array<Record<string, unknown>> = [
    {
      type: 'gitlab',
      projectId: gitlabProjectId,
      ref: branch,
      sha: commitSha,
    },
    {
      type: 'gitlab',
      projectId: String(gitlabProjectId),
      ref: branch,
      sha: commitSha,
    },
  ];

  const errors: string[] = [];

  for (const gitSource of gitSourceVariants) {
    try {
      const result = await client.request<{ id?: string; url?: string }>('/v13/deployments', {
        method: 'POST',
        body: JSON.stringify({
          name: vercelProjectName,
          project,
          target: 'production',
          gitSource,
          meta: {
            deploySource: 'site-agent',
            gitlabCommitSha: commitSha,
          },
        }),
      });

      const deploymentId = result.id;
      if (!deploymentId) {
        errors.push('Vercel accepted deploy but returned no deployment id');
        continue;
      }

      console.log(
        `[Vercel] Deployment created from SHA ${commitSha.slice(0, 8)}: ${deploymentId}`
      );

      return {
        deployTriggered: true,
        method: 'api-sha',
        deploymentId,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(msg.slice(0, 300));
      console.warn(`[Vercel] SHA deployment attempt failed: ${msg.slice(0, 200)}`);
    }
  }

  if (input.allowUnpinnedFallback) {
    console.warn('[Vercel] SHA deploy failed; using unpinned deploy hook (allowUnpinnedFallback)');
    const hookResult = await triggerVercelRedeploy(vercelProjectId);
    return {
      deployTriggered: hookResult.deployTriggered,
      deployHookId: hookResult.deployHookId,
      method: 'deploy-hook',
      error: hookResult.error,
    };
  }

  throw new Error(
    `Could not start a Vercel deployment for commit ${commitSha.slice(0, 8)}. ${errors.join(' | ') || 'Unknown error'}`
  );
}
