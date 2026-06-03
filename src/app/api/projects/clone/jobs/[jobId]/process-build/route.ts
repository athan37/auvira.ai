import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob, BUILD_STEPS } from '@/lib/db/models/CloneJob';
import { getLLMClient } from '@/lib/llm/llmClient';
import { buildGenerateSiteSpecPrompt } from '@/lib/agent/prompts';
import { generateDesignBriefAgent, getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import { generateCloneWebsiteFiles } from '@/lib/clone/cloneTemplateSelection';
import { validateGeneratedFiles } from '@/lib/builder/validateGeneratedFiles';
import { validateGeneratedSite } from '@/lib/builder/validateGeneratedSite';
import { createGitLabProject } from '@/lib/gitlab/createProject';
import { commitFilesToGitLab } from '@/lib/gitlab/commitFiles';
import { createVercelProject } from '@/lib/vercel/createVercelProject';
import { WebsiteProject } from '@/models/WebsiteProject';
import { ProjectAction } from '@/models/ProjectAction';
import mongoose from 'mongoose';

export const runtime = 'nodejs';
export const maxDuration = 300;

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

function generateUniqueProjectName(baseName: string): string {
  const timestamp = Date.now().toString(36).slice(-6);
  const suffix = Math.random().toString(36).slice(2, 6);
  const sanitized = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${sanitized}-${timestamp}-${suffix}`;
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

  if (job.status !== 'building') {
    return NextResponse.json({
      ok: true,
      jobId: job._id.toString(),
      status: job.status,
    });
  }

  const jobId = job._id;
  const llmClient = getLLMClient();

  try {
    // ── STEP 1: Generate site spec ─────────────────────────────────────
    await markStepRunning(jobId, 'generate_site_spec');
    await appendLog(jobId, 'building', 'Generating site spec from approved data');
    await CloneJob.updateOne({ _id: jobId }, { $set: { currentStageLabel: 'Preparing website structure...', progressPercent: 91 } });

    const specResult = await llmClient.generateJSON<any>({
      system: "You are a website modernization agent. Return only JSON matching the schema.",
      prompt: buildGenerateSiteSpecPrompt(
        job.businessProfile as Record<string, unknown>,
        job.factualSiteData as Record<string, unknown>,
        ''
      ),
      schema: {} as any,
    });
    const siteSpec = specResult.data;
    await markStepDone(jobId, 'generate_site_spec');
    await appendLog(jobId, 'building', 'Site spec generated');

    // ── STEP 2: Generate files ─────────────────────────────────────────
    await markStepRunning(jobId, 'generate_files');
    await appendLog(jobId, 'building', 'Generating website files');
    await CloneJob.updateOne({ _id: jobId }, { $set: { currentStageLabel: 'Generating Next.js website files...', progressPercent: 92 } });

    let designBrief;
    try {
      designBrief = await generateDesignBriefAgent(
        job.businessProfile as Record<string, unknown>,
        siteSpec as Record<string, unknown>,
        job.sourceUrl
      );
    } catch {
      const bp = job.businessProfile as any;
      designBrief = getDefaultDesignBrief(
        bp.industry?.toLowerCase().includes('legal') ? 'legal' :
        bp.industry?.toLowerCase().includes('health') ? 'healthcare' :
        bp.industry?.toLowerCase().includes('restaurant') ? 'restaurant' :
        bp.industry?.toLowerCase().includes('plumb') || bp.industry?.toLowerCase().includes('hvac') ? 'home-services' : 'general-service'
      );
    }

    const uniqueName = generateUniqueProjectName(job.projectName || (job.businessProfile as any)?.businessName || 'generated-site');
    const generated = generateCloneWebsiteFiles(
      siteSpec as unknown as import('@/lib/agent/schemas').SiteSpec,
      uniqueName,
      designBrief,
      job.suggestedTemplate
    );
    await markStepDone(jobId, 'generate_files');
    await appendLog(jobId, 'building', `Generated ${generated.files.length} files`);

    // ── STEP 3: Validate build ─────────────────────────────────────────
    await markStepRunning(jobId, 'validate_build');
    await appendLog(jobId, 'building', 'Running build validation');
    await CloneJob.updateOne({ _id: jobId }, { $set: { currentStageLabel: 'Running local build gate...', progressPercent: 93 } });

    const validationErrors = validateGeneratedFiles(generated.files);
    if (validationErrors.length > 0) {
      const errMsg = 'Validation failed: ' + validationErrors.map(e => `${e.file}: ${e.error}`).join('; ');
      await markStepFailed(jobId, 'validate_build', errMsg);
      await appendLog(jobId, 'building', errMsg);
      throw new Error(errMsg);
    }

    const buildResult = await validateGeneratedSite({ files: generated.files, projectName: uniqueName });
    if (!buildResult.ok) {
      const errMsg = 'Build gate failed: ' + buildResult.errors.join('; ');
      await markStepFailed(jobId, 'validate_build', errMsg);
      await appendLog(jobId, 'building', errMsg);
      await CloneJob.updateOne({ _id: jobId }, { $set: { status: 'failed', error: errMsg, currentStageLabel: 'Build validation failed' } });
      return NextResponse.json({ ok: false, error: errMsg, stage: 'validate_build' }, { status: 500 });
    }
    await CloneJob.updateOne({ _id: jobId }, { $set: { generatedSiteValidation: { ok: buildResult.ok, logs: buildResult.logs, errors: buildResult.errors, durationMs: buildResult.durationMs } } });
    await markStepDone(jobId, 'validate_build');
    await appendLog(jobId, 'building', 'Build gate passed');

    // ── STEP 4: Create GitLab project ──────────────────────────────────
    await markStepRunning(jobId, 'create_gitlab_project');
    await appendLog(jobId, 'building', 'Creating GitLab repository');
    await CloneJob.updateOne({ _id: jobId }, { $set: { currentStageLabel: 'Creating GitLab repository...', progressPercent: 94 } });

    let gitlabResult;
    try {
      gitlabResult = await createGitLabProject({ name: uniqueName });
    } catch (error) {
      const errMsg = `GitLab creation failed: ${error instanceof Error ? error.message : 'Unknown'}`;
      await markStepFailed(jobId, 'create_gitlab_project', errMsg);
      await appendLog(jobId, 'building', errMsg);
      throw new Error(errMsg);
    }
    await markStepDone(jobId, 'create_gitlab_project');
    await appendLog(jobId, 'building', `GitLab project created: ${gitlabResult.id}`);

    // ── STEP 5: Commit files ───────────────────────────────────────────
    await markStepRunning(jobId, 'commit_files');
    await appendLog(jobId, 'building', 'Committing files to GitLab');
    await CloneJob.updateOne({ _id: jobId }, { $set: { currentStageLabel: 'Committing generated code...', progressPercent: 95 } });

    try {
      await commitFilesToGitLab({ projectId: gitlabResult.id, commitMessage: 'Initial commit: generated website files', files: generated.files });
    } catch (error) {
      const errMsg = `GitLab commit failed: ${error instanceof Error ? error.message : 'Unknown'}`;
      await markStepFailed(jobId, 'commit_files', errMsg);
      await appendLog(jobId, 'building', errMsg);
      throw new Error(errMsg);
    }
    await markStepDone(jobId, 'commit_files');
    await appendLog(jobId, 'building', 'Files committed to GitLab');

    // ── STEP 6: Create Vercel project ──────────────────────────────────
    await markStepRunning(jobId, 'create_vercel_project');
    await appendLog(jobId, 'deploying', 'Creating Vercel project');
    await CloneJob.updateOne({ _id: jobId }, { $set: { currentStageLabel: 'Creating Vercel project...', progressPercent: 96 } });

    let vercelResult = null;
    let deploymentStatus: 'triggered' | 'trigger_failed' | 'failed' | 'pending' = 'pending';
    let vercelNote = 'Deployment may take 1-3 minutes.';

    try {
      vercelResult = await createVercelProject({
        name: uniqueName,
        gitlabProjectId: gitlabResult.id,
        gitlabRepoUrl: gitlabResult.http_url_to_repo,
        gitlabPathWithNamespace: gitlabResult.path_with_namespace,
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

    // ── STEP 7: Trigger deployment ──────────────────────────────────────
    await markStepRunning(jobId, 'trigger_deployment');
    await CloneJob.updateOne({ _id: jobId }, { $set: { currentStageLabel: 'Starting Vercel deployment...', progressPercent: 97 } });

    if (vercelResult) {
      await markStepDone(jobId, 'trigger_deployment');
      await appendLog(jobId, 'deploying', 'Vercel deployment triggered');
    }

    // ── STEP 8: Wait for Vercel (mark as running) ──────────────────────
    await markStepRunning(jobId, 'wait_for_vercel');
    await CloneJob.updateOne({ _id: jobId }, { $set: { currentStageLabel: 'Waiting for Vercel to finish building...', progressPercent: 97 } });

    // ── SAVE WEBSITEPROJECT ─────────────────────────────────────────────
    const project = new WebsiteProject({
      ownerId: new mongoose.Types.ObjectId(userId),
      mode: 'clone',
      name: (job.businessProfile as any)?.businessName || job.projectName || uniqueName,
      sourceUrl: job.sourceUrl,
      siteSpec: siteSpec as any,
      businessProfile: job.businessProfile,
      factualSiteData: job.factualSiteData,
      template: job.suggestedTemplate,
      generatedSiteValidation: job.generatedSiteValidation,
      gitlab: {
        projectId: gitlabResult.id,
        repoUrl: gitlabResult.web_url,
        httpUrlToRepo: gitlabResult.http_url_to_repo,
        webUrl: gitlabResult.web_url,
        defaultBranch: 'main',
      },
      deployment: vercelResult ? {
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
      } : {
        provider: 'vercel',
        status: deploymentStatus,
        ready: false,
        note: vercelNote,
      },
      status: 'building',
    });
    await project.save();

    await ProjectAction.create({
      projectId: project._id,
      ownerId: new mongoose.Types.ObjectId(userId),
      type: 'clone_created',
      status: 'succeeded',
      input: { sourceUrl: job.sourceUrl, projectName: job.projectName },
      output: { gitlabProjectId: gitlabResult.id, deploymentStatus },
    });

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
      { $set: { status: 'failed', error: errMsg, currentStageLabel: 'Build failed' } }
    );
    await appendLog(jobId, 'failed', `process-build failed: ${errMsg}`);
    return NextResponse.json({ ok: false, error: errMsg, stage: 'job_failed' }, { status: 500 });
  }
}