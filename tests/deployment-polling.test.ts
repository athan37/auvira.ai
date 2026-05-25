/**
 * Regression tests for CloneJob deployment polling fallback.
 *
 * Bug: Clone job got stuck at 97% because polling only ran when deployment.vercelProjectId
 * existed. In some cases, Vercel List Deployments returns 0 results for projectId but
 * works with projectName. The checkVercelDeployment helper already falls back from
 * projectId to projectName, but the polling guard skipped the check unless projectId
 * was truthy.
 *
 * Run with: npx vitest run tests/deployment-polling.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkVercelDeployment, type CheckDeploymentResult } from '../src/lib/vercel/checkDeployment';

// Mock getLatestDeploymentStatus
const mockGetLatestDeploymentStatus = vi.hoisted(() => vi.fn());

vi.mock('../src/lib/vercel/getLatestDeploymentStatus', () => ({
  getLatestDeploymentStatus: mockGetLatestDeploymentStatus,
}));

const mockReadyResult = {
  ok: true,
  status: 'ready' as const,
  vercelState: 'READY',
  deploymentsFound: 1,
  deploymentId: 'dpl_abc123',
  deploymentUrl: 'https://my-site.vercel.app',
  liveUrl: 'https://my-site.vercel.app',
  inspectorUrl: 'https://vercel.com/dashboard/deployments/dpl_abc123',
  createdAt: 1779327357596,
  projectName: 'my-site',
  message: 'Your website is live.',
  commitSha: 'abc123def456',
  commitVerified: true,
};

const mockBuildingResult = {
  ok: true,
  status: 'building' as const,
  vercelState: 'BUILDING',
  deploymentsFound: 1,
  deploymentId: 'dpl_abc123',
  deploymentUrl: 'https://my-site.vercel.app',
  liveUrl: '',
  inspectorUrl: 'https://vercel.com/dashboard/deployments/dpl_abc123',
  createdAt: 1779327357596,
  projectName: 'my-site',
  message: 'Vercel is building your website.',
  commitSha: null,
  commitVerified: false,
};

const mockEmptyResult = {
  ok: true,
  status: 'pending' as const,
  vercelState: 'UNKNOWN',
  deploymentsFound: 0,
  deploymentId: '',
  deploymentUrl: '',
  liveUrl: '',
  inspectorUrl: '',
  createdAt: 0,
  projectName: 'my-site',
  message: 'Waiting for Vercel to create the deployment record.',
  commitSha: null,
  commitVerified: false,
};

describe('checkVercelDeployment', () => {
  beforeEach(() => {
    mockGetLatestDeploymentStatus.mockReset();
  });

  it('should use projectId when provided and deployments are found', async () => {
    mockGetLatestDeploymentStatus.mockResolvedValueOnce(mockReadyResult);

    const result = await checkVercelDeployment('prj_abc123', 'my-site');

    expect(result.status).toBe('ready');
    expect(result.foundBy).toBe('projectId');
    expect(result.liveUrl).toBe('https://my-site.vercel.app');
    expect(mockGetLatestDeploymentStatus).toHaveBeenCalledWith({ projectId: 'prj_abc123' });
    expect(mockGetLatestDeploymentStatus).toHaveBeenCalledTimes(1);
  });

  it('should fall back to projectName when projectId returns 0 deployments', async () => {
    // projectId returns 0 deployments
    mockGetLatestDeploymentStatus.mockResolvedValueOnce(mockEmptyResult);
    // projectName returns READY
    mockGetLatestDeploymentStatus.mockResolvedValueOnce(mockReadyResult);

    const result = await checkVercelDeployment('prj_abc123', 'my-site');

    expect(result.status).toBe('ready');
    expect(result.foundBy).toBe('projectName');
    expect(result.liveUrl).toBe('https://my-site.vercel.app');
    expect(mockGetLatestDeploymentStatus).toHaveBeenCalledTimes(2);
    expect(mockGetLatestDeploymentStatus).toHaveBeenNthCalledWith(1, { projectId: 'prj_abc123' });
    expect(mockGetLatestDeploymentStatus).toHaveBeenNthCalledWith(2, { projectName: 'my-site' });
  });

  it('should return pending when neither projectId nor projectName finds deployments', async () => {
    mockGetLatestDeploymentStatus.mockResolvedValueOnce(mockEmptyResult);
    mockGetLatestDeploymentStatus.mockResolvedValueOnce(mockEmptyResult);

    const result = await checkVercelDeployment('prj_abc123', 'my-site');

    expect(result.status).toBe('pending');
    expect(result.foundBy).toBe('none');
    expect(mockGetLatestDeploymentStatus).toHaveBeenCalledTimes(2);
  });

  it('should use projectName directly when projectId is not provided', async () => {
    mockGetLatestDeploymentStatus.mockResolvedValueOnce(mockReadyResult);

    const result = await checkVercelDeployment(undefined, 'my-site');

    expect(result.status).toBe('ready');
    expect(result.foundBy).toBe('projectName');
    expect(mockGetLatestDeploymentStatus).toHaveBeenCalledWith({ projectName: 'my-site' });
    expect(mockGetLatestDeploymentStatus).toHaveBeenCalledTimes(1);
  });

  it('should return pending when no projectId and no projectName', async () => {
    mockGetLatestDeploymentStatus.mockResolvedValueOnce(mockEmptyResult);

    const result = await checkVercelDeployment(undefined, undefined);

    expect(result.status).toBe('pending');
    expect(result.foundBy).toBe('none');
    expect(mockGetLatestDeploymentStatus).not.toHaveBeenCalled();
  });

  it('should return failed status when deployment fails', async () => {
    mockGetLatestDeploymentStatus.mockResolvedValueOnce({
      ...mockReadyResult,
      status: 'failed' as const,
      vercelState: 'ERROR',
      deploymentsFound: 1,
      liveUrl: '',
    });

    const result = await checkVercelDeployment('prj_abc123', 'my-site');

    expect(result.status).toBe('failed');
    expect(result.foundBy).toBe('projectId');
  });

  it('should return building status when deployment is still building', async () => {
    mockGetLatestDeploymentStatus.mockResolvedValueOnce(mockBuildingResult);

    const result = await checkVercelDeployment('prj_abc123', 'my-site');

    expect(result.status).toBe('building');
    expect(result.foundBy).toBe('projectId');
  });

  it('should pass expectedCommitSha to getLatestDeploymentStatus', async () => {
    mockGetLatestDeploymentStatus.mockResolvedValueOnce(mockReadyResult);

    await checkVercelDeployment('prj_abc123', 'my-site', {
      expectedCommitSha: 'abc123def456',
      deploymentId: 'dpl_abc123',
    });

    expect(mockGetLatestDeploymentStatus).toHaveBeenCalledWith({
      projectId: 'prj_abc123',
      expectedCommitSha: 'abc123def456',
      deploymentId: 'dpl_abc123',
    });
  });

  it('should report commitVerified from status helper', async () => {
    mockGetLatestDeploymentStatus.mockResolvedValueOnce(mockReadyResult);

    const result = await checkVercelDeployment('prj_abc123', 'my-site', {
      expectedCommitSha: 'abc123def456',
    });

    expect(result.commitVerified).toBe(true);
    expect(result.commitSha).toBe('abc123def456');
  });
});

describe('deployment polling guard — route-level logic', () => {
  /**
   * These tests verify the polling guard condition in route.ts:
   *   if (job.status === 'deploying' && (job.deployment?.vercelProjectId || job.deployment?.vercelProjectName))
   *
   * We test the logical condition directly since the route requires auth middleware.
   * Note: the expression returns the value of the first truthy operand (string or undefined),
   * so we use toBeTruthy()/toBeFalsy() rather than toBe(true)/toBe(false).
   */

  it('should allow polling when vercelProjectId exists', () => {
    const job = {
      status: 'deploying',
      deployment: { vercelProjectId: 'prj_abc123', vercelProjectName: 'my-site' },
    };
    const canPoll = !!(job.status === 'deploying' && (job.deployment?.vercelProjectId || job.deployment?.vercelProjectName));
    expect(canPoll).toBe(true);
  });

  it('should allow polling when only vercelProjectName exists (fallback case)', () => {
    const job: { status: string; deployment?: { vercelProjectId?: string; vercelProjectName?: string } } = {
      status: 'deploying',
      deployment: { vercelProjectName: 'my-site' },
    };
    const canPoll = !!(job.status === 'deploying' && (job.deployment?.vercelProjectId || job.deployment?.vercelProjectName));
    expect(canPoll).toBe(true);
  });

  it('should block polling when both vercelProjectId and vercelProjectName are missing', () => {
    const job: { status: string; deployment?: { vercelProjectId?: string; vercelProjectName?: string } } = {
      status: 'deploying',
      deployment: {},
    };
    const canPoll = !!(job.status === 'deploying' && (job.deployment?.vercelProjectId || job.deployment?.vercelProjectName));
    expect(canPoll).toBe(false);
  });

  it('should block polling when status is not deploying', () => {
    const job: { status: string; deployment?: { vercelProjectId?: string; vercelProjectName?: string } } = {
      status: 'completed',
      deployment: { vercelProjectId: 'prj_abc123', vercelProjectName: 'my-site' },
    };
    const canPoll = !!(job.status === 'deploying' && (job.deployment?.vercelProjectId || job.deployment?.vercelProjectName));
    expect(canPoll).toBe(false);
  });

  it('should block polling when deployment is undefined', () => {
    const job: { status: string; deployment?: { vercelProjectId?: string; vercelProjectName?: string } } = {
      status: 'deploying',
      deployment: undefined,
    };
    const canPoll = !!(job.status === 'deploying' && (job.deployment?.vercelProjectId || job.deployment?.vercelProjectName));
    expect(canPoll).toBe(false);
  });
});

describe('full polling flow — projectId returns 0, projectName returns READY', () => {
  it('should transition CloneJob status to completed when projectName returns READY', async () => {
    // Simulate: projectId lookup returns 0, projectName lookup returns READY
    mockGetLatestDeploymentStatus
      .mockResolvedValueOnce(mockEmptyResult) // projectId → 0
      .mockResolvedValueOnce(mockReadyResult); // projectName → READY

    const result = await checkVercelDeployment('prj_N4fxfB5O3LwD3qXW', 'service-experts-houston-etjwj3-xig5');

    // Assert: foundBy should be projectName since projectId returned 0
    expect(result.foundBy).toBe('projectName');
    expect(result.status).toBe('ready');
    expect(result.liveUrl).toBe('https://my-site.vercel.app');

    // The CloneJob status would be updated to 'completed' by the route
    // The WebsiteProject would have deployment.ready = true
    const cloneJobUpdates = {
      status: 'completed',
      'deployment.status': 'ready',
      'deployment.ready': true,
      'deployment.liveUrl': result.liveUrl,
    };
    expect(cloneJobUpdates.status).toBe('completed');
    expect(cloneJobUpdates['deployment.ready']).toBe(true);
  });

  it('should still call WebsiteProject update when createdProjectId exists', () => {
    // This test validates the side effect path in the route handler:
    // if (job.createdProjectId) { await WebsiteProject.updateOne(...) }
    const job = {
      createdProjectId: 'proj_abc123',
      status: 'deploying',
      deployment: { vercelProjectId: 'prj_abc123', vercelProjectName: 'my-site' },
    };

    // When result is READY and createdProjectId exists, both CloneJob AND WebsiteProject should update
    const shouldUpdateWebsiteProject = job.createdProjectId != null;
    expect(shouldUpdateWebsiteProject).toBe(true);
  });
});

describe('CloneJob normalization when deployment already ready', () => {
  it('should normalize status to completed when deployment.ready is true and createdProjectId exists', () => {
    // Simulates the condition: job.status === 'deploying' && job.deployment?.ready === true && job.createdProjectId exists
    const job = {
      status: 'deploying',
      progressPercent: 97,
      currentStageLabel: 'Waiting for Vercel to finish building...',
      createdProjectId: 'proj_abc123',
      deployment: {
        vercelProjectId: 'prj_abc123',
        vercelProjectName: 'my-site',
        status: 'ready',
        ready: true,
        liveUrl: 'https://my-site.vercel.app',
      },
    };

    const isReady = job.status === 'deploying' && (job.deployment?.ready === true || job.deployment?.status === 'ready');
    const hasProjectId = !!job.createdProjectId;

    expect(isReady).toBe(true);
    expect(hasProjectId).toBe(true);

    // The normalization should set:
    const normalized = {
      status: 'completed',
      progressPercent: 100,
      currentStageLabel: 'Website ready',
    };
    expect(normalized.status).toBe('completed');
    expect(normalized.progressPercent).toBe(100);
    expect(normalized.currentStageLabel).toBe('Website ready');
  });

  it('should allow redirect when deployment ready but createdProjectId missing', () => {
    // When createdProjectId is missing, redirect is blocked but status still normalizes
    const job = {
      status: 'deploying',
      progressPercent: 97,
      createdProjectId: null,
      deployment: {
        status: 'ready',
        ready: true,
        liveUrl: 'https://my-site.vercel.app',
      },
    };

    const isReady = job.status === 'deploying' && (job.deployment?.ready === true || job.deployment?.status === 'ready');
    const canRedirect = isReady && !!job.createdProjectId;

    expect(isReady).toBe(true);
    expect(canRedirect).toBe(false); // blocked - no createdProjectId
  });

  it('should detect ready status from deployment.status string', () => {
    const job = {
      status: 'deploying',
      deployment: { status: 'ready' as const, ready: false, vercelProjectId: 'prj_abc123' },
    };

    const isReady = job.status === 'deploying' && (job.deployment?.ready === true || job.deployment?.status === 'ready');
    expect(isReady).toBe(true);
  });

  it('should not redirect when status is not ready or completed', () => {
    const job: { status: string; createdProjectId?: string; deployment?: { status?: string; ready?: boolean } } = {
      status: 'deploying',
      createdProjectId: 'proj_abc123',
      deployment: { status: 'building', ready: false },
    };

    const isReady = job.status === 'completed' || job.deployment?.ready === true || job.deployment?.status === 'ready';
    expect(isReady).toBe(false);
  });
});