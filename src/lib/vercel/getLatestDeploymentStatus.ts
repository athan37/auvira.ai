import { VercelClient } from './vercelClient';
import { commitShaMatches, getDeploymentCommitSha } from './deploymentCommitSha';
import { fetchDeploymentAliases } from './fetchDeploymentAliases';
import { pickProductionLiveUrl } from './pickProductionLiveUrl';
import type { VercelListDeploymentsResponse } from './types';

export interface DeploymentStatusInput {
  projectId?: string;
  projectName?: string;
  since?: string;
  deployHookId?: string;
  teamId?: string;
  expectedCommitSha?: string;
  deploymentId?: string;
}

export interface DeploymentStatusResult {
  ok: boolean;
  status: 'pending' | 'building' | 'ready' | 'failed';
  vercelState: string;
  deploymentsFound: number;
  deploymentId: string;
  deploymentUrl: string;
  liveUrl: string;
  productionAliases: string[];
  inspectorUrl: string;
  createdAt: number;
  readyAt?: number;
  projectName: string;
  message: string;
  commitSha: string | null;
  commitVerified: boolean;
}

type VercelDeployment = VercelListDeploymentsResponse['deployments'][number];

function mapDeploymentState(
  latest: VercelDeployment,
  options: { expectedCommitSha?: string; requireCommitMatch: boolean }
): Pick<DeploymentStatusResult, 'status' | 'message' | 'liveUrl' | 'commitSha' | 'commitVerified'> {
  const state = latest.state;
  const deploymentCommit = getDeploymentCommitSha(latest.meta);
  const commitVerified =
    !options.requireCommitMatch ||
    !options.expectedCommitSha ||
    commitShaMatches(options.expectedCommitSha, deploymentCommit);

  if (state === 'READY') {
    if (options.requireCommitMatch && options.expectedCommitSha && !commitVerified) {
      return {
        status: 'building',
        liveUrl: '',
        commitSha: deploymentCommit,
        commitVerified: false,
        message: 'Waiting for your deploy to finish building…',
      };
    }
    return {
      status: 'ready',
      liveUrl: latest.url ? `https://${latest.url}` : '',
      commitSha: deploymentCommit || options.expectedCommitSha || null,
      commitVerified: true,
      message: 'Your website is live.',
    };
  }

  if (state === 'ERROR' || state === 'CANCELED') {
    return {
      status: 'failed',
      liveUrl: '',
      commitSha: deploymentCommit,
      commitVerified: false,
      message: 'Vercel deployment failed.',
    };
  }

  if (state === 'BUILDING' || state === 'QUEUED' || state === 'INITIALIZING' || state === 'DEPLOYING') {
    return {
      status: 'building',
      liveUrl: '',
      commitSha: deploymentCommit || options.expectedCommitSha || null,
      commitVerified: false,
      message: 'Vercel is building your website.',
    };
  }

  if (state === 'DELETING' || state === 'ARCHIVED') {
    return {
      status: 'failed',
      liveUrl: '',
      commitSha: deploymentCommit,
      commitVerified: false,
      message: `Deployment state: ${state}`,
    };
  }

  return {
    status: 'building',
    liveUrl: '',
    commitSha: deploymentCommit || options.expectedCommitSha || null,
    commitVerified: false,
    message: 'Deployment is being prepared.',
  };
}

function pickRelevantDeployment(
  deployments: VercelDeployment[],
  input: DeploymentStatusInput
): VercelDeployment | null {
  if (deployments.length === 0) return null;

  const sorted = [...deployments].sort((a, b) => b.createdAt - a.createdAt);

  if (input.deploymentId) {
    const byId = sorted.find((d) => d.uid === input.deploymentId);
    if (byId) return byId;
  }

  if (input.expectedCommitSha) {
    const bySha = sorted.find((d) =>
      commitShaMatches(input.expectedCommitSha!, getDeploymentCommitSha(d.meta))
    );
    if (bySha) return bySha;
  }

  if (input.deployHookId) {
    const byHook = sorted.find((d) => d.meta?.deployHookId === input.deployHookId);
    if (byHook) return byHook;
  }

  return sorted[0];
}

export async function getLatestDeploymentStatus(
  input: DeploymentStatusInput
): Promise<DeploymentStatusResult> {
  const { projectId, projectName, since, deployHookId, expectedCommitSha, deploymentId } = input;
  const requireCommitMatch = Boolean(expectedCommitSha);

  const client = new VercelClient();
  const params = new URLSearchParams();
  if (projectId) params.set('projectId', projectId);
  if (since) {
    const sinceMs = new Date(since).getTime();
    if (!isNaN(sinceMs)) {
      params.set('since', String(Math.floor(sinceMs - 10000)));
    }
  }
  params.set('limit', '20');

  try {
    const response = await client.request<VercelListDeploymentsResponse>(
      `/v6/deployments?${params.toString()}`,
      { method: 'GET' }
    );

    let deployments = response.deployments || [];

    if (projectName && !projectId) {
      deployments = deployments.filter((d) => d.name === projectName);
    }

    if (deployments.length === 0 && since && projectId) {
      const retryParams = new URLSearchParams();
      retryParams.set('projectId', projectId);
      retryParams.set('limit', '20');
      const retryResponse = await client.request<VercelListDeploymentsResponse>(
        `/v6/deployments?${retryParams.toString()}`,
        { method: 'GET' }
      );
      deployments = retryResponse.deployments || [];
      if (projectName && !projectId) {
        deployments = deployments.filter((d) => d.name === projectName);
      }
    }

    if (deployments.length === 0) {
      return {
        ok: true,
        status: 'pending',
        vercelState: 'UNKNOWN',
        deploymentsFound: 0,
        deploymentId: '',
        deploymentUrl: '',
        liveUrl: '',
        productionAliases: [],
        inspectorUrl: '',
        createdAt: 0,
        projectName: projectName || '',
        message: 'Waiting for Vercel to create the deployment record.',
        commitSha: expectedCommitSha || null,
        commitVerified: false,
      };
    }

    const latest = pickRelevantDeployment(deployments, {
      projectId,
      projectName,
      since,
      deployHookId,
      expectedCommitSha,
      deploymentId,
    });

    if (!latest) {
      return {
        ok: true,
        status: 'pending',
        vercelState: 'UNKNOWN',
        deploymentsFound: deployments.length,
        deploymentId: '',
        deploymentUrl: '',
        liveUrl: '',
        productionAliases: [],
        inspectorUrl: '',
        createdAt: 0,
        projectName: projectName || '',
        message: 'Waiting for Vercel to create the deployment record.',
        commitSha: expectedCommitSha || null,
        commitVerified: false,
      };
    }

    const mapped = mapDeploymentState(latest, { expectedCommitSha, requireCommitMatch });
    const deploymentUrl = latest.url ? `https://${latest.url}` : '';
    const productionAliases =
      mapped.status === 'ready' && latest.uid
        ? await fetchDeploymentAliases(latest.uid)
        : [];
    const liveUrl =
      mapped.status === 'ready'
        ? pickProductionLiveUrl({
            aliases: productionAliases,
            deploymentUrl,
          }) || mapped.liveUrl
        : mapped.liveUrl;

    return {
      ok: true,
      status: mapped.status,
      vercelState: latest.state,
      deploymentsFound: deployments.length,
      deploymentId: latest.uid,
      deploymentUrl,
      liveUrl,
      productionAliases,
      inspectorUrl: `https://vercel.com/dashboard/deployments/${latest.uid}`,
      createdAt: latest.createdAt,
      readyAt: latest.readyAt,
      projectName: latest.name,
      message: mapped.message,
      commitSha: mapped.commitSha,
      commitVerified: mapped.commitVerified,
    };
  } catch (error) {
    console.error(
      '[Vercel] Failed to get deployment status:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return {
      ok: false,
      status: 'pending',
      vercelState: 'ERROR',
      deploymentsFound: 0,
      deploymentId: '',
      deploymentUrl: '',
      liveUrl: '',
      productionAliases: [],
      inspectorUrl: '',
      createdAt: 0,
      projectName: projectName || '',
      message: 'Could not fetch Vercel deployment status.',
      commitSha: expectedCommitSha || null,
      commitVerified: false,
    };
  }
}

export function parseDeployHookId(url: string): string | null {
  const parts = url.split('/').filter(Boolean);
  return parts.at(-1) ?? null;
}
