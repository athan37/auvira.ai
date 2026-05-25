import { VercelClient } from './vercelClient';
import type { DeploymentStatus } from './types';

export async function getDeploymentStatus(projectName: string): Promise<DeploymentStatus | null> {
  try {
    const client = new VercelClient();

    // Get recent deployments for the project
    const result = await client.request<{
      deployments: Array<{
        uid: string;
        url: string;
        status: string;
        readyState: string;
      }>;
    }>(`/v13/deployments?projectName=${projectName}&limit=1`);

    if (result.deployments && result.deployments.length > 0) {
      const latest = result.deployments[0];
      return {
        status: latest.status,
        url: latest.url,
        readyState: latest.readyState,
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to get deployment status:', error);
    return null;
  }
}