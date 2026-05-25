import { getLatestDeploymentStatus } from './getLatestDeploymentStatus';

export interface CheckDeploymentOptions {
  since?: string;
  deployHookId?: string;
  expectedCommitSha?: string;
  deploymentId?: string;
}

export interface CheckDeploymentResult {
  status: 'pending' | 'building' | 'ready' | 'failed';
  liveUrl: string | null;
  deploymentUrl: string | null;
  productionAliases: string[];
  inspectorUrl: string | null;
  error?: string;
  message: string;
  foundBy?: 'projectId' | 'projectName' | 'none';
  commitSha: string | null;
  commitVerified: boolean;
}

export async function checkVercelDeployment(
  vercelProjectId: string | undefined,
  vercelProjectName?: string,
  options: CheckDeploymentOptions = {}
): Promise<CheckDeploymentResult> {
  const statusInput = {
    since: options.since,
    deployHookId: options.deployHookId,
    expectedCommitSha: options.expectedCommitSha,
    deploymentId: options.deploymentId,
  };

  let result = vercelProjectId
    ? await getLatestDeploymentStatus({ projectId: vercelProjectId, ...statusInput })
    : {
        ok: false,
        status: 'pending' as const,
        vercelState: '',
        deploymentsFound: 0,
        deploymentId: '',
        deploymentUrl: '',
        liveUrl: '',
        productionAliases: [],
        inspectorUrl: '',
        createdAt: 0,
        projectName: '',
        message: 'No projectId provided',
        commitSha: null,
        commitVerified: false,
      };

  if (result.deploymentsFound > 0) {
    return {
      status: result.status,
      liveUrl: result.liveUrl || null,
      deploymentUrl: result.deploymentUrl || null,
      productionAliases: result.productionAliases || [],
      inspectorUrl: result.inspectorUrl || null,
      message: result.message,
      foundBy: 'projectId',
      commitSha: result.commitSha,
      commitVerified: result.commitVerified,
    };
  }

  if (vercelProjectName) {
    result = await getLatestDeploymentStatus({ projectName: vercelProjectName, ...statusInput });

    if (result.deploymentsFound > 0) {
      return {
        status: result.status,
        liveUrl: result.liveUrl || null,
        deploymentUrl: result.deploymentUrl || null,
        productionAliases: result.productionAliases || [],
        inspectorUrl: result.inspectorUrl || null,
        message: result.message,
        foundBy: 'projectName',
        commitSha: result.commitSha,
        commitVerified: result.commitVerified,
      };
    }
  }

  if (!result.ok) {
    return {
      status: 'pending',
      liveUrl: null,
      deploymentUrl: null,
      productionAliases: [],
      inspectorUrl: null,
      error: 'Failed to fetch Vercel status',
      message: result.message,
      foundBy: 'none',
      commitSha: result.commitSha,
      commitVerified: false,
    };
  }

  return {
    status: result.status,
    liveUrl: result.liveUrl || null,
    deploymentUrl: result.deploymentUrl || null,
    productionAliases: result.productionAliases || [],
    inspectorUrl: result.inspectorUrl || null,
    message: result.message,
    foundBy: 'none',
    commitSha: result.commitSha,
    commitVerified: result.commitVerified,
  };
}
