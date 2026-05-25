import { VercelClient } from './vercelClient';

export async function triggerVercelRedeploy(projectId: string): Promise<{
  success: boolean;
  deployTriggered: boolean;
  deployHookId?: string;
  error?: string;
}> {
  const client = new VercelClient();

  try {
    // Get the project's deploy hooks
    const project = await client.request<{
      link?: {
        deployHooks?: Array<{ id: string; url: string }>;
      };
    }>(`/v2/projects/${projectId}`, {
      method: 'GET',
    });

    const deployHooks = project.link?.deployHooks;
    if (!deployHooks || deployHooks.length === 0) {
      return {
        success: false,
        deployTriggered: false,
        error: 'No deploy hooks found for this project',
      };
    }

    // Use the most recent deploy hook
    const hook = deployHooks[deployHooks.length - 1];
    const hookUrl = hook.url;
    const hookId = hook.id;

    // Deploy hooks are triggered with a plain POST (no Bearer token).
    const response = await fetch(hookUrl, { method: 'POST' });

    const responseText = await response.text();
    const triggered = response.ok || response.status === 307 ||
      responseText.includes('"job"') || responseText.includes('"state"');

    return {
      success: triggered,
      deployTriggered: triggered,
      deployHookId: hookId,
      error: triggered ? undefined : `Deploy trigger returned: ${response.status} ${responseText}`,
    };
  } catch (error) {
    return {
      success: false,
      deployTriggered: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}