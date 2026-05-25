import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob, BUILD_STEPS } from '@/lib/db/models/CloneJob';
import { createVercelProject } from '@/lib/vercel/createVercelProject';
import {
  generateUniqueProjectName,
  saveClonePreviewToGitLab,
} from '@/lib/clone/persistClonePreview';
import { ensureClonePreviewWorkspace } from '@/lib/clone/ensureClonePreviewWorkspace';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

async function markStepRunning(jobId: mongoose.Types.ObjectId, key: string) {
  await CloneJob.updateOne(
    { _id: jobId, 'buildSteps.key': key },
    { $set: { 'buildSteps.$.status': 'running', 'buildSteps.$.startedAt': new Date() } }
  );
}

async function markStepDone(jobId: mongoose.Types.ObjectId, key: string) {
  await CloneJob.updateOne(
    { _id: jobId, 'buildSteps.key': key },
    { $set: { 'buildSteps.$.status': 'done', 'buildSteps.$.completedAt': new Date() } }
  );
}

async function markStepFailed(jobId: mongoose.Types.ObjectId, key: string, error: string) {
  await CloneJob.updateOne(
    { _id: jobId, 'buildSteps.key': key },
    { $set: { 'buildSteps.$.status': 'failed', 'buildSteps.$.error': error, 'buildSteps.$.completedAt': new Date() } }
  );
}

async function appendLog(jobId: mongoose.Types.ObjectId, stage: string, message: string, data?: unknown) {
  await CloneJob.updateOne(
    { _id: jobId },
    { $push: { logs: { timestamp: new Date(), stage, message, data } } }
  );
}

export async function POST(
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

  if (job.status !== 'preview_ready') {
    return NextResponse.json({
      ok: false,
      error: `Cannot deploy preview — job is in '${job.status}' state, expected 'preview_ready'.`,
      status: job.status,
    }, { status: 400 });
  }

  const jobId = job._id;
  try {
    await ensureClonePreviewWorkspace(job);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Preview workspace not found. Please rebuild preview.';
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  // Keep preview server running during deploy — will stop after Vercel is ready

  // Set job to building with technical steps
  const stepsInit = BUILD_STEPS.map(s => ({ ...s, status: 'pending' as const }));
  await CloneJob.updateOne({ _id: jobId }, {
    $set: {
      status: 'building',
      currentStageLabel: 'Creating GitLab repository...',
      progressPercent: 90,
      buildSteps: stepsInit,
    },
  });

  const businessName =
    (job.businessProfile as { businessName?: string } | undefined)?.businessName ||
    job.projectName ||
    'generated-site';
  const uniqueName = generateUniqueProjectName(businessName);

  try {
    let project;
    let gitlabProjectId: number;

    if (job.createdProjectId) {
      await markStepRunning(jobId, 'create_gitlab_project');
      await markStepDone(jobId, 'create_gitlab_project');
      await markStepRunning(jobId, 'commit_files');
      await CloneJob.updateOne({ _id: jobId }, { $set: { currentStageLabel: 'Syncing latest files to GitLab...', progressPercent: 93 } });
      const saved = await saveClonePreviewToGitLab(job, userId);
      project = saved.project;
      gitlabProjectId = saved.gitlabProjectId;
      await markStepDone(jobId, 'commit_files');
      await appendLog(jobId, 'building', 'Using existing GitLab project');
    } else {
      await markStepRunning(jobId, 'create_gitlab_project');
      await CloneJob.updateOne({ _id: jobId }, { $set: { currentStageLabel: 'Creating GitLab repository...', progressPercent: 91 } });
      await appendLog(jobId, 'building', 'Creating GitLab repository');

      const saved = await saveClonePreviewToGitLab(job, userId);
      project = saved.project;
      gitlabProjectId = saved.gitlabProjectId;
      await markStepDone(jobId, 'create_gitlab_project');
      await markStepDone(jobId, 'commit_files');
      await appendLog(jobId, 'building', `GitLab project ready: ${gitlabProjectId}`);
    }

    // Create Vercel project
    await markStepRunning(jobId, 'create_vercel_project');
    await CloneJob.updateOne({ _id: jobId }, { $set: { currentStageLabel: 'Creating Vercel project...', progressPercent: 95 } });

    let vercelResult = null;
    let deploymentStatus: 'triggered' | 'trigger_failed' | 'failed' | 'pending' = 'pending';
    let vercelNote = 'Deployment may take 1-3 minutes.';

    try {
      vercelResult = await createVercelProject({
        name: uniqueName,
        gitlabProjectId,
        gitlabRepoUrl: project.gitlab.httpUrlToRepo,
        gitlabPathWithNamespace: project.gitlab.pathWithNamespace,
      });
      deploymentStatus = vercelResult.status;
      vercelNote = vercelResult.note;
    } catch (error) {
      deploymentStatus = 'failed';
      vercelNote = `Vercel failed: ${error instanceof Error ? error.message : 'Unknown'}`;
      await appendLog(jobId, 'deploying', vercelNote);
    }
    await markStepDone(jobId, 'create_vercel_project');
    await appendLog(jobId, 'deploying', `Vercel project created: ${vercelResult?.vercelProjectName || 'failed'}`);

    project.deployment = vercelResult
      ? {
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
        }
      : {
          provider: 'vercel',
          status: deploymentStatus,
          ready: false,
          note: vercelNote,
        };
    project.status = 'building';
    await project.save();

    // Update CloneJob with deployment metadata and createdProjectId
    await CloneJob.updateOne(
      { _id: jobId },
      {
        $set: {
          status: 'deploying',
          currentStageLabel: 'Waiting for Vercel to finish building...',
          progressPercent: 97,
          createdProjectId: project._id,
          deployment: vercelResult ? {
            provider: vercelResult.provider,
            status: vercelResult.status,
            ready: false,
            vercelProjectId: vercelResult.projectId,
            vercelProjectName: vercelResult.vercelProjectName,
            deployHookId: vercelResult.deployHookId,
            triggeredAt: vercelResult.triggeredAt,
            expectedProductionUrl: vercelResult.expectedProductionUrl,
            liveUrl: null,
            deploymentUrl: null,
            inspectorUrl: null,
            note: vercelResult.note,
            error: vercelResult.error,
          } : {
            provider: 'vercel',
            status: deploymentStatus,
            ready: false,
            note: vercelNote,
          },
        },
      }
    );
    await appendLog(jobId, 'deploying', 'WebsiteProject created, waiting for Vercel');

    return NextResponse.json({
      ok: true,
      jobId: job._id.toString(),
      status: 'deploying',
      projectId: project._id.toString(),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    await CloneJob.updateOne(
      { _id: jobId },
      { $set: { status: 'failed', error: errMsg, currentStageLabel: 'Deployment failed' } }
    );
    await appendLog(jobId, 'failed', `deploy-preview failed: ${errMsg}`);
    return NextResponse.json({ ok: false, error: errMsg, stage: 'deploy_failed' }, { status: 500 });
  }
}