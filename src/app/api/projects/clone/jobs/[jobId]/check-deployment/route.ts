import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob } from '@/lib/db/models/CloneJob';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  const { userId } = authResult;

  const job = await CloneJob.findOne({
    _id: new mongoose.Types.ObjectId(params.jobId),
    ownerId: new mongoose.Types.ObjectId(userId),
  });

  if (!job) {
    return NextResponse.json(
      { ok: false, stage: 'job_not_found', message: 'Clone job not found or you do not have access.' },
      { status: 404 }
    );
  }

  if (job.status !== 'deploying') {
    return NextResponse.json({
      ok: true,
      jobId: job._id.toString(),
      status: job.status,
      deployment: job.deployment,
    });
  }

  // If no deployment metadata at all, return warning
  if (!job.deployment?.vercelProjectId && !job.deployment?.vercelProjectName) {
    return NextResponse.json({
      ok: true,
      jobId: job._id.toString(),
      status: 'deploying',
      deployment: job.deployment,
      warning: 'Deployment metadata is missing. Please open the project workspace or retry.',
    });
  }

  // Import Vercel status checker lazily to avoid startup errors
  type VercelStatusResult = {
    status: 'pending' | 'building' | 'ready' | 'failed';
    liveUrl: string | null;
    deploymentUrl: string | null;
    inspectorUrl: string | null;
    error?: string;
    message: string;
    foundBy?: 'projectId' | 'projectName' | 'none';
  };
  let vercelStatus: VercelStatusResult | null = null;
  try {
    const { checkVercelDeployment } = await import('@/lib/vercel/checkDeployment');
    console.log(`[check-deployment] Checking Vercel deployment by projectId=${job.deployment?.vercelProjectId} projectName=${job.deployment?.vercelProjectName}`);
    vercelStatus = await checkVercelDeployment(
      job.deployment?.vercelProjectId as string | undefined,
      job.deployment?.vercelProjectName as string | undefined
    );
    console.log(`[check-deployment] Vercel result: status=${vercelStatus.status} foundBy=${vercelStatus.foundBy} liveUrl=${vercelStatus.liveUrl}`);
  } catch (error) {
    console.error('[check-deployment] Vercel status check failed:', error);
  }

  const deployment = job.deployment as Record<string, unknown> | undefined;

  // Determine if deployment is done
  const newStatus = vercelStatus?.status === 'ready'
    ? 'completed'
    : vercelStatus?.status === 'failed'
    ? 'failed'
    : 'deploying';

  const liveUrl = vercelStatus?.liveUrl as string | null | undefined;
  const deploymentUrl = vercelStatus?.deploymentUrl as string | null | undefined;
  const inspectorUrl = vercelStatus?.inspectorUrl as string | null | undefined;
  const error = vercelStatus?.error as string | undefined;

  // Update CloneJob if status changed or we got a liveUrl
  if (newStatus !== job.status || liveUrl) {
    const stageLabel = newStatus === 'completed'
      ? 'Website ready'
      : newStatus === 'failed'
      ? 'Deployment failed'
      : 'Waiting for Vercel to finish building...';
    if (newStatus === 'completed') {
      console.log('[clone-job] Deployment ready, marking CloneJob completed');
      if (!job.createdProjectId) console.log('[clone-job] createdProjectId missing, cannot redirect');
    }
    console.log(`[check-deployment] Updating CloneJob status ${job.status} -> ${newStatus}`);
    await CloneJob.updateOne(
      { _id: job._id },
      {
        $set: {
          status: newStatus,
          currentStageLabel: stageLabel,
          progressPercent: newStatus === 'completed' ? 100 : 97,
          'deployment.liveUrl': liveUrl ?? null,
          'deployment.deploymentUrl': deploymentUrl ?? null,
          'deployment.inspectorUrl': inspectorUrl ?? null,
          'deployment.status': newStatus === 'completed' ? 'ready' : newStatus === 'failed' ? 'failed' : 'building',
          'deployment.ready': newStatus === 'completed',
          ...(error ? { 'deployment.error': error } : {}),
        },
      }
    );

    // Update WebsiteProject if it exists
    if (job.createdProjectId) {
      const { WebsiteProject } = await import('@/models/WebsiteProject');
      await WebsiteProject.updateOne(
        { _id: job.createdProjectId },
        {
          $set: {
            'deployment.status': newStatus === 'completed' ? 'ready' : newStatus === 'failed' ? 'failed' : 'building',
            'deployment.ready': newStatus === 'completed',
            'deployment.liveUrl': liveUrl ?? null,
            'deployment.deploymentUrl': deploymentUrl ?? null,
            'deployment.inspectorUrl': inspectorUrl ?? null,
            ...(newStatus === 'completed' ? { status: 'deployed' } : {}),
          },
        }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    jobId: job._id.toString(),
    status: newStatus,
    deployment: {
      ...deployment,
      liveUrl: liveUrl ?? deployment?.liveUrl ?? null,
      deploymentUrl: deploymentUrl ?? deployment?.deploymentUrl ?? null,
      inspectorUrl: inspectorUrl ?? deployment?.inspectorUrl ?? null,
      status: newStatus === 'completed' ? 'ready' : newStatus === 'failed' ? 'failed' : 'building',
      ready: newStatus === 'completed',
    },
  });
}