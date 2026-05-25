import { VercelClient } from './vercelClient';
import { parseDeployHookId } from './getLatestDeploymentStatus';
import type { CreateVercelProjectInput, VercelDeploymentResult } from './types';

export async function createVercelProject(input: CreateVercelProjectInput): Promise<VercelDeploymentResult> {
  const client = new VercelClient();
  const teamId = client.teamId;
  const scopeNote = teamId ? `using teamId=${teamId}` : 'using personal account scope';
  const vercelTeamIdUsed = !!teamId;
  console.log(`[Vercel] Creating project "${input.name}" ${scopeNote}`);

  // Sanitize project name for Vercel (lowercase, no spaces, only a-z, 0-9, -)
  const safeName = input.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');

  // The gitRepository.repo should be the full path_with_namespace from GitLab
  // e.g., "moe-group6784220/my-project"
  const repo = input.gitlabPathWithNamespace || extractPathFromRepoUrl(input.gitlabRepoUrl);
  console.log(`[Vercel] GitLab repo path: "${repo}"`);

  const body: Record<string, unknown> = {
    name: safeName,
    framework: input.framework || 'nextjs',
    gitRepository: {
      type: 'gitlab',
      repo: repo,
    },
    buildCommand: 'npm run build',
    installCommand: 'npm install',
  };

  let projectId: string;
  let projectUrl: string;

  try {
    const result = await client.request<{
      id: string;
      name: string;
      url?: string;
      projectUrl?: string;
      liveUrl?: string;
      gitRepository?: { type: string; repo: string; deployedLogs?: string };
    }>('/v13/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    projectId = result.id;
    projectUrl = result.projectUrl || `https://vercel.com/dashboard?q=${safeName}`;

    console.log(`[Vercel] Project created: id=${projectId}, name=${result.name}, url=${projectUrl}`);
    console.log(`[Vercel] Project gitRepository: ${JSON.stringify(result.gitRepository || 'not returned')}`);
  } catch (error) {
    console.error(`[Vercel] Project creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }

  // Disable SSO protection so deployment is publicly accessible
  try {
    await client.request<{ ssoProtection: null }>(`/v2/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ssoProtection: null }),
    });
    console.log(`[Vercel] SSO protection disabled for project ${projectId}`);
  } catch (error) {
    // Non-fatal: log and continue
    console.error(`[Vercel] Failed to disable SSO protection: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Create deploy hook for main branch
  let deployHookCreated = false;
  let deployHookUrl: string | null = null;
  let deployHookId: string | null = null;
  let deployHookTriggerStatus: number | undefined;
  let deployHookTriggerResponse: string | undefined;

  try {
    const hookResult = await client.request<{
      id?: string;
      link?: {
        deployHooks?: Array<{ id: string; url: string }>;
      };
      deployHooks?: Array<{ id: string; url: string }>;
    }>(`/v2/projects/${projectId}/deploy-hooks`, {
      method: 'POST',
      body: JSON.stringify({ name: 'auto-deploy', ref: 'main' }),
    });

    console.log(`[Vercel] Deploy hook creation response:`, JSON.stringify(hookResult).slice(0, 500));

    // V2 API returns full project object with deployHooks nested under link.deployHooks
    let hookId: string | null = null;

    if (hookResult.deployHooks && hookResult.deployHooks.length > 0) {
      const newHook = hookResult.deployHooks[hookResult.deployHooks.length - 1];
      hookId = newHook.id;
      deployHookUrl = newHook.url;
    } else if (hookResult.link?.deployHooks && hookResult.link.deployHooks.length > 0) {
      // Hooks nested under link.deployHooks
      const newHook = hookResult.link.deployHooks[hookResult.link.deployHooks.length - 1];
      hookId = newHook.id;
      deployHookUrl = newHook.url;
    }

    // If we have a hookId but no URL, construct the standard Vercel deploy hook URL
    if (hookId && !deployHookUrl) {
      deployHookUrl = `https://api.vercel.com/v1/integrations/deploy/${projectId}/${hookId}`;
    }

    // Parse deploy hook ID from URL
    if (deployHookUrl) {
      deployHookId = parseDeployHookId(deployHookUrl);
    }

    deployHookCreated = !!deployHookUrl;
    console.log(`[Vercel] Deploy hook created: ${deployHookCreated}, hookId=${deployHookId || 'null'}, hookUrl=${deployHookUrl ? 'present' : 'missing'}`);
  } catch (error) {
    console.error(`[Vercel] Failed to create deploy hook: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Trigger deployment via deploy hook
  let deployTriggered = false;
  let jobResponse: unknown = null;

  if (deployHookCreated && deployHookUrl) {
    try {
      const triggerResponse = await fetch(deployHookUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${client.token}`,
          'Content-Type': 'application/json',
        },
      });

      deployHookTriggerStatus = triggerResponse.status;
      const responseText = await triggerResponse.text();
      deployHookTriggerResponse = responseText.slice(0, 500);

      console.log(`[Vercel] Deploy hook trigger response: status=${triggerResponse.status}, body=${deployHookTriggerResponse.slice(0, 200)}`);

      // The deploy hook returns 307 redirect on success, so triggerResponse.ok will be false
      // Check if we got a redirect or a job response
      deployTriggered = triggerResponse.ok || triggerResponse.status === 307 ||
        responseText.includes('"job"') || responseText.includes('"state"');

      // Try to parse job info from response
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.job) {
          jobResponse = parsed.job;
        }
      } catch {
        // Response may not be JSON, that's ok
      }

      if (deployTriggered) {
        console.log(`[Vercel] Deploy hook triggered successfully: status=${triggerResponse.status}`);
      } else {
        console.error(`[Vercel] Deploy hook trigger returned non-success: ${triggerResponse.status} - ${deployHookTriggerResponse.slice(0, 200)}`);
      }
    } catch (error) {
      console.error(`[Vercel] Failed to trigger deployment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      deployHookTriggerResponse = String(error);
    }
  } else {
    console.log(`[Vercel] Skipping deploy trigger: hookCreated=${deployHookCreated}, hookUrl=${deployHookUrl ? 'present' : 'missing'}`);
  }

  // Build the appropriate response
  const triggeredAt = new Date().toISOString();
  const expectedProductionUrl = `https://${safeName}.vercel.app`;
  const baseResult = {
    provider: 'vercel' as const,
    status: (deployHookCreated && deployTriggered ? 'triggered' : 'trigger_failed') as 'triggered' | 'trigger_failed',
    ready: false,
    projectId,
    projectUrl,
    vercelProjectName: safeName,
    deployHookCreated,
    deployTriggered,
    deployHookId: deployHookId || undefined,
    deployHookUrl: deployHookUrl || undefined,
    triggeredAt,
    note: 'Build passed locally. Vercel deployment has started and may take 1-3 minutes.',
    expectedProductionUrl,
    // liveUrl is always null after trigger - will be set by polling
    liveUrl: null as string | null,
    // deploymentUrl and inspectorUrl are null until deployment is READY
    deploymentUrl: null as string | null,
    inspectorUrl: null as string | null,
  };

  if (deployHookCreated && deployTriggered) {
    return {
      ...baseResult,
      _debug: {
        teamScopeUsed: scopeNote,
        vercelTeamIdUsed,
        gitRepositoryRepo: repo,
        deployHookTriggerStatus,
        deployHookTriggerResponse,
      },
    };
  }

  if (deployHookCreated) {
    return {
      ...baseResult,
      status: 'trigger_failed',
      note: 'Deploy hook created but trigger failed. Check Vercel dashboard for deployment status.',
      _debug: {
        teamScopeUsed: scopeNote,
        vercelTeamIdUsed,
        gitRepositoryRepo: repo,
        deployHookTriggerStatus,
        deployHookTriggerResponse,
      },
    };
  }

  // Deploy hook creation failed
  return {
    ...baseResult,
    status: 'trigger_failed',
    note: 'Deploy hook creation failed. Go to Vercel dashboard to trigger deployment manually.',
    error: 'Deploy hook creation failed',
    _debug: {
      teamScopeUsed: scopeNote,
      vercelTeamIdUsed,
      gitRepositoryRepo: repo,
      deployHookTriggerStatus,
      deployHookTriggerResponse,
    },
  };
}

function extractPathFromRepoUrl(repoUrl: string): string {
  // Extract "owner/repo" from URLs like:
  // https://gitlab.com/moe-group6784220/my-project.git
  // git@gitlab.com:moe-group6784220/my-project.git
  const match = repoUrl.match(/gitlab\.com[/:](.+)\.git$/);
  if (match) {
    return match[1];
  }
  // Fallback: try to extract from any gitlab.com URL
  const fallbackMatch = repoUrl.match(/gitlab\.com\/(.+)/);
  if (fallbackMatch) {
    return fallbackMatch[1].replace(/\.git$/, '');
  }
  throw new Error(`Could not extract GitLab path from: ${repoUrl}`);
}