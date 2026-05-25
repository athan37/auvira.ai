import { VercelClient } from './vercelClient';

interface DeploymentAliasResponse {
  alias?: string[];
}

/** Load assigned production/preview aliases for a deployment. */
export async function fetchDeploymentAliases(deploymentId: string): Promise<string[]> {
  if (!deploymentId) return [];

  try {
    const client = new VercelClient();
    const deployment = await client.request<DeploymentAliasResponse>(
      `/v13/deployments/${deploymentId}`,
      { method: 'GET' }
    );
    return deployment.alias || [];
  } catch (error) {
    console.warn(
      `[Vercel] Failed to fetch aliases for ${deploymentId}:`,
      error instanceof Error ? error.message : 'Unknown error'
    );
    return [];
  }
}
