import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { ProjectAction } from '@/models/ProjectAction';
import type { WebsitePlan, ScratchIntake } from '@/lib/agent/schemas';
import {
  buildWebsiteFromPlan,
  resolveScratchIntake,
} from '@/lib/agent/buildWebsiteFromPlan';
import { createGitLabProject } from '@/lib/gitlab/createProject';
import { commitFilesToGitLab } from '@/lib/gitlab/commitFiles';
import { createVercelProject } from '@/lib/vercel/createVercelProject';
import { createWebsiteAnalyticsConfigForProject } from '@/lib/analytics/config/websiteAnalyticsConfigService';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  const { userId } = authResult;

  try {
    const body = await request.json();
    const { websitePlan, projectName, validateBuild = true, intake: intakeBody } = body as {
      websitePlan: WebsitePlan;
      projectName: string;
      validateBuild?: boolean;
      intake?: Partial<ScratchIntake>;
    };

    if (!websitePlan) {
      return NextResponse.json({ ok: false, error: 'websitePlan is required' }, { status: 400 });
    }

    const intake = resolveScratchIntake(websitePlan, intakeBody);

    const buildResult = await buildWebsiteFromPlan({
      websitePlan,
      intake,
      projectName,
      validateBuild,
      logPrefix: 'PROJECTS/SCRATCH/BUILD',
    });

    if (!buildResult.ok || !buildResult.generated || !buildResult.siteSpec || !buildResult.uniqueName) {
      return NextResponse.json(
        {
          ok: false,
          error: buildResult.error,
          stage: buildResult.stage,
          stageLogs: buildResult.stageLogs,
          duration_ms: buildResult.duration_ms,
          siteSpec: buildResult.siteSpec,
          scratchValidation: buildResult.scratchValidation,
          fidelityValidation: buildResult.fidelityValidation,
          generatedSiteValidation: buildResult.generatedSiteValidation,
        },
        { status: 500 }
      );
    }

    const { generated, siteSpec, uniqueName, stageLogs } = buildResult;
    const buildValidation = buildResult.generatedSiteValidation ?? null;

    let gitlabResult;
    try {
      gitlabResult = await createGitLabProject({ name: uniqueName });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error: `GitLab project creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          stage: 'gitlab_project_creation_failed',
          stageLogs,
          duration_ms: Date.now() - startTime,
          siteSpec,
        },
        { status: 500 }
      );
    }

    try {
      await commitFilesToGitLab({
        projectId: gitlabResult.id,
        commitMessage: 'Initial commit: generated website from plan',
        files: generated.files,
      });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error: `GitLab commit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          stage: 'gitlab_commit_failed',
          stageLogs,
          duration_ms: Date.now() - startTime,
          gitlab: { projectId: gitlabResult.id, repoUrl: gitlabResult.web_url },
        },
        { status: 500 }
      );
    }

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
      vercelNote = `Vercel project creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    const deploymentFailed = deploymentStatus !== 'triggered';

    const project = new WebsiteProject({
      ownerId: new mongoose.Types.ObjectId(userId),
      mode: 'scratch',
      name: websitePlan.businessName || projectName,
      siteSpec: siteSpec as any,
      websitePlan: websitePlan as any,
      template: websitePlan.suggestedTemplate
        ? {
            category: websitePlan.suggestedTemplate.category,
            variant: websitePlan.suggestedTemplate.variant || 'modern-clean',
            reason: websitePlan.suggestedTemplate.reason || '',
          }
        : undefined,
      scratchValidation: buildResult.scratchValidation
        ? { ok: buildResult.scratchValidation.ok, issues: buildResult.scratchValidation.issues }
        : undefined,
      generatedSiteValidation: buildValidation
        ? {
            ok: buildValidation.ok,
            logs: buildValidation.logs,
            errors: buildValidation.errors,
            durationMs: buildValidation.durationMs,
          }
        : undefined,
      gitlab: {
        projectId: gitlabResult.id,
        repoUrl: gitlabResult.web_url,
        httpUrlToRepo: gitlabResult.http_url_to_repo,
        webUrl: gitlabResult.web_url,
        defaultBranch: 'main',
      },
      deployment: vercelResult
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
          },
      status: deploymentFailed ? 'failed' : 'building',
    });

    await project.save();

    try {
      await createWebsiteAnalyticsConfigForProject({
        projectId: project._id,
        ownerId: project.ownerId,
        publicSiteKey: generated.analytics?.publicSiteKey,
        allowedOrigins: [
          vercelResult?.expectedProductionUrl ?? '',
          vercelResult?.projectUrl ?? '',
        ].filter(Boolean),
      });
    } catch (analyticsError) {
      console.warn('[scratch/build] Analytics config creation failed:', analyticsError);
    }

    const action = new ProjectAction({
      projectId: project._id,
      ownerId: new mongoose.Types.ObjectId(userId),
      type: 'scratch_created',
      status: deploymentFailed ? 'failed' : 'succeeded',
      input: { websitePlan, projectName, intake },
      output: {
        gitlabProjectId: gitlabResult.id,
        deploymentStatus,
      },
    });
    await action.save();

    return NextResponse.json({
      ok: true,
      deploymentFailed,
      warning: deploymentFailed
        ? `Website files were saved, but deployment did not start: ${vercelNote}`
        : undefined,
      mode: 'scratch',
      stage: deploymentFailed ? 'repo_created_vercel_trigger_failed' : 'repo_and_deployment_triggered',
      stageLogs,
      duration_ms: Date.now() - startTime,
      projectId: project._id.toString(),
      siteSpec,
      websitePlan,
      template: websitePlan.suggestedTemplate,
      generatedSiteValidation: buildValidation,
      gitlab: {
        projectId: gitlabResult.id,
        repoUrl: gitlabResult.web_url,
        httpUrlToRepo: gitlabResult.http_url_to_repo,
      },
      deployment: project.deployment,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        ok: false,
        error: message,
        stage: 'unknown_error',
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
