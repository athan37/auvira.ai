import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { ProjectAction } from '@/models/ProjectAction';
import { getLLMClient } from '@/lib/llm/llmClient';
import { type BusinessProfile, siteSpecSchema, type SiteSpec, type DesignBrief, type WebsitePlan, type ScratchIntake } from '@/lib/agent/schemas';
import { buildGenerateSiteSpecPrompt } from '@/lib/agent/prompts';
import { generateDesignBriefAgent, getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { validateGeneratedSite } from '@/lib/builder/validateGeneratedSite';
import { validateScratchContent } from '@/lib/agent/validateScratchContent';
import { convertPlanToSiteSpec } from '@/lib/agent/convertPlanToSiteSpec';
import { createGitLabProject } from '@/lib/gitlab/createProject';
import { commitFilesToGitLab } from '@/lib/gitlab/commitFiles';
import { createVercelProject } from '@/lib/vercel/createVercelProject';
import { type TemplateVariant } from '@/lib/builder/themePresets';
import type { TemplateSelection } from '@/lib/agent/selectTemplateAgent';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

interface StageLog {
  stage: string;
  timestamp: string;
  duration_ms?: number;
}

function logStage(stage: string, duration_ms?: number): StageLog {
  const entry: StageLog = { stage, timestamp: new Date().toISOString() };
  if (duration_ms !== undefined) entry.duration_ms = duration_ms;
  console.log(`[PROJECTS/SCRATCH/BUILD] Stage: ${stage}${duration_ms !== undefined ? ` (${duration_ms}ms)` : ''}`);
  return entry;
}

function generateUniqueProjectName(baseName: string): string {
  const timestamp = Date.now().toString(36).slice(-6);
  const suffix = Math.random().toString(36).slice(2, 6);
  const sanitized = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${sanitized}-${timestamp}-${suffix}`;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let stageLogs: StageLog[] = [];

  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  const { userId } = authResult;

  try {
    const body = await request.json();
    const { websitePlan, projectName, validateBuild = true } = body as {
      websitePlan: WebsitePlan;
      projectName: string;
      validateBuild?: boolean;
    };

    if (!websitePlan) {
      return NextResponse.json({ ok: false, error: 'websitePlan is required' }, { status: 400 });
    }

    stageLogs.push(logStage('scratch_intake_received'));

    const intake: ScratchIntake = {
      businessName: websitePlan.businessName,
      industry: websitePlan.industry,
      location: '',
      services: '',
      targetCustomers: websitePlan.targetCustomers?.join(', ') || '',
      mainGoal: websitePlan.primaryGoal,
      phone: '',
      email: '',
      address: '',
      desiredStyle: websitePlan.suggestedTemplate?.category || 'professional',
      notes: '',
    };

    stageLogs.push(logStage('scratch_content_validation_start'));
    const scratchValidation = validateScratchContent(websitePlan, intake);
    stageLogs.push(logStage('scratch_content_validation_done', Date.now() - startTime));

    if (!scratchValidation.ok) {
      return NextResponse.json({
        ok: false,
        error: `Content validation failed: ${scratchValidation.issues.join('; ')}`,
        stage: 'scratch_content_validation_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        scratchValidation,
      }, { status: 500 });
    }

    stageLogs.push(logStage('plan_to_sitespec_start'));
    let siteSpec: SiteSpec;
    try {
      siteSpec = convertPlanToSiteSpec(websitePlan, intake);
    } catch (error) {
      stageLogs.push(logStage('plan_to_sitespec_failed'));
      return NextResponse.json({
        ok: false,
        error: `Failed to convert plan to siteSpec: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'plan_to_sitespec_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
      }, { status: 500 });
    }
    stageLogs.push(logStage('plan_to_sitespec_done', Date.now() - startTime));

    stageLogs.push(logStage('design_brief_start'));
    let designBrief: DesignBrief;
    try {
      designBrief = await generateDesignBriefAgent(
        {
          businessName: websitePlan.businessName,
          industry: websitePlan.industry,
          description: websitePlan.positioning,
          services: websitePlan.contentPlan?.sections?.find(s => s.type === 'services')?.contentNotes || [],
          location: '',
          phone: '',
          email: '',
          brandTone: websitePlan.suggestedTemplate?.category || 'professional',
          targetCustomers: websitePlan.targetCustomers,
        } as Record<string, unknown>,
        siteSpec as unknown as Record<string, unknown>,
        ''
      );
    } catch (error) {
      stageLogs.push(logStage('design_brief_failed'));
      designBrief = getDefaultDesignBrief(websitePlan.suggestedTemplate?.category as 'legal' | 'healthcare' | 'home-services' | 'restaurant' | 'general-service' || 'general-service');
      console.error(`[PROJECTS/SCRATCH/BUILD] Design brief failed, using default: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    stageLogs.push(logStage('design_brief_done', Date.now() - startTime));

    const template: TemplateSelection = websitePlan.suggestedTemplate?.category ? {
      category: websitePlan.suggestedTemplate.category as any,
      variant: (websitePlan.suggestedTemplate.variant as TemplateVariant) || 'modern-clean',
      reason: websitePlan.suggestedTemplate.reason || 'From website plan template selection.',
    } : {
      category: 'general-service',
      variant: 'modern-clean',
      reason: 'Default template selected.',
    };

    const name = projectName || websitePlan.businessName || 'generated-website';
    const uniqueName = generateUniqueProjectName(name);

    stageLogs.push(logStage('build_files_start'));

    let generated;
    try {
      generated = generateWebsiteFiles(siteSpec, uniqueName, designBrief, template);
    } catch (error) {
      stageLogs.push(logStage('build_files_failed'));
      return NextResponse.json({
        ok: false,
        error: `File generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'build_files_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
      }, { status: 500 });
    }
    stageLogs.push(logStage('build_files_done', Date.now() - startTime));

    let buildValidation: { ok: boolean; tempDir: string; logs: string; errors: string[]; durationMs: number } | null = null;

    if (validateBuild) {
      stageLogs.push(logStage('build_gate_start'));

      const buildResult = await validateGeneratedSite({
        files: generated.files,
        projectName: uniqueName,
      });

      buildValidation = {
        ok: buildResult.ok,
        tempDir: buildResult.tempDir,
        logs: buildResult.logs,
        errors: buildResult.errors,
        durationMs: buildResult.durationMs,
      };

      if (!buildResult.ok) {
        stageLogs.push(logStage('build_gate_failed'));
        return NextResponse.json({
          ok: false,
          error: `Build validation failed: ${buildResult.errors.join('; ')}`,
          stage: 'generated_site_validation_failed',
          stageLogs,
          duration_ms: Date.now() - startTime,
          siteSpec,
          generatedSiteValidation: buildValidation,
        }, { status: 500 });
      }
      stageLogs.push(logStage('build_gate_done', Date.now() - startTime));
    }

    stageLogs.push(logStage('gitlab_project_start'));

    let gitlabResult;
    try {
      gitlabResult = await createGitLabProject({ name: uniqueName });
    } catch (error) {
      stageLogs.push(logStage('gitlab_project_failed'));
      return NextResponse.json({
        ok: false,
        error: `GitLab project creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'gitlab_project_creation_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        siteSpec,
      }, { status: 500 });
    }
    stageLogs.push(logStage('gitlab_project_created', Date.now() - startTime));

    stageLogs.push(logStage('gitlab_commit_start'));

    try {
      await commitFilesToGitLab({
        projectId: gitlabResult.id,
        commitMessage: 'Initial commit: generated website from plan',
        files: generated.files,
      });
    } catch (error) {
      stageLogs.push(logStage('gitlab_commit_failed'));
      return NextResponse.json({
        ok: false,
        error: `GitLab commit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'gitlab_commit_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        gitlab: { projectId: gitlabResult.id, repoUrl: gitlabResult.web_url },
      }, { status: 500 });
    }
    stageLogs.push(logStage('gitlab_commit_done', Date.now() - startTime));

    let vercelResult = null;
    let deploymentStatus: 'triggered' | 'trigger_failed' | 'failed' | 'pending' = 'pending';
    let vercelNote = 'Deployment may take 1-3 minutes.';

    stageLogs.push(logStage('vercel_deploy_start'));

    try {
      vercelResult = await createVercelProject({
        name: uniqueName,
        gitlabProjectId: gitlabResult.id,
        gitlabRepoUrl: gitlabResult.http_url_to_repo,
        gitlabPathWithNamespace: gitlabResult.path_with_namespace,
      });
      deploymentStatus = vercelResult.status;
      vercelNote = vercelResult.note;
      stageLogs.push(logStage('vercel_deploy_done', Date.now() - startTime));
    } catch (error) {
      deploymentStatus = 'failed';
      vercelNote = `Vercel project creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      stageLogs.push(logStage('vercel_deploy_failed'));
    }

    // Save to MongoDB
    const project = new WebsiteProject({
      ownerId: new mongoose.Types.ObjectId(userId),
      mode: 'scratch',
      name: websitePlan.businessName || name,
      siteSpec: siteSpec as any,
      websitePlan: websitePlan as any,
      template: websitePlan.suggestedTemplate ? {
        category: websitePlan.suggestedTemplate.category,
        variant: websitePlan.suggestedTemplate.variant || 'modern-clean',
        reason: websitePlan.suggestedTemplate.reason || '',
      } : undefined,
      scratchValidation: { ok: scratchValidation.ok, issues: scratchValidation.issues },
      generatedSiteValidation: buildValidation ? { ok: buildValidation.ok, logs: buildValidation.logs, errors: buildValidation.errors, durationMs: buildValidation.durationMs } : undefined,
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

    const action = new ProjectAction({
      projectId: project._id,
      ownerId: new mongoose.Types.ObjectId(userId),
      type: 'scratch_created',
      status: 'succeeded',
      input: { websitePlan, projectName },
      output: {
        gitlabProjectId: gitlabResult.id,
        deploymentStatus,
      },
    });
    await action.save();

    return NextResponse.json({
      ok: true,
      mode: 'scratch',
      stage: deploymentStatus === 'triggered' ? 'repo_and_deployment_triggered' : 'repo_created_vercel_trigger_failed',
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
    stageLogs.push(logStage('unknown_error'));
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      ok: false,
      error: message,
      stage: 'unknown_error',
      stageLogs,
      duration_ms: Date.now() - startTime,
    }, { status: 500 });
  }
}