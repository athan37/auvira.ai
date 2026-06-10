import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { ProjectAction } from '@/models/ProjectAction';
import { crawlWebsite } from '@/lib/crawler/crawlWebsite';
import { getLLMClient } from '@/lib/llm/llmClient';
import { requireGenerateJsonResult } from '@/lib/llm/requireGenerateJsonResult';
import { businessProfileSchema, type BusinessProfile, type FactualSiteData } from '@/lib/agent/schemas';
import { buildExtractProfilePrompt } from '@/lib/agent/prompts';
import { extractFactualSiteDataAgent } from '@/lib/agent/extractFactualSiteDataAgent';
import { proposeWebsitePlanFromCrawlAgent } from '@/lib/agent/proposeWebsitePlanFromCrawlAgent';
import { validateClonePlanWarnings } from '@/lib/agent/validateClonePlanWarnings';
import { buildWebsiteFromPlan } from '@/lib/agent/buildWebsiteFromPlan';
import { resolveCloneIntake } from '@/lib/clone/resolveCloneIntake';
import { buildCloneCrawlPromptInput, buildCrawlSummaryForPlan } from '@/lib/clone/buildCloneCrawlPromptInput';
import { validateGeneratedFiles } from '@/lib/builder/validateGeneratedFiles';
import { selectTemplateAgent } from '@/lib/agent/selectTemplateAgent';
import { createGitLabProject } from '@/lib/gitlab/createProject';
import { commitFilesToGitLab } from '@/lib/gitlab/commitFiles';
import { createVercelProject } from '@/lib/vercel/createVercelProject';
import type { CrawledSite } from '@/lib/crawler/types';
import { createProjectRun, logProjectStep, withProjectStep, safeError } from '@/lib/project-logs/projectLogger';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

interface StageLog {
  stage: string;
  timestamp: string;
  duration_ms?: number;
}

function logStage(stage: string, duration_ms?: number): StageLog {
  const entry: StageLog = {
    stage,
    timestamp: new Date().toISOString(),
  };
  if (duration_ms !== undefined) {
    entry.duration_ms = duration_ms;
  }
  console.log(`[PROJECTS/CLONE] Stage: ${stage}${duration_ms !== undefined ? ` (${duration_ms}ms)` : ''}`);
  return entry;
}

function buildLimitedPromptInput(crawlResult: CrawledSite) {
  const input = buildCloneCrawlPromptInput(crawlResult);
  return {
    pageTitles: input.pageTitles,
    pageTexts: input.pageTexts,
    totalLength: input.totalLength,
    warning: input.warning,
    signalsSummary: input.signalsSummary,
  };
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

  // Create execution run for logging
  let projectId = 'pending';
  const runId = createProjectRun({
    projectId,
    userId,
    operation: 'generation',
  });

  try {
    const body = await request.json();
    const { url, instruction, projectName, validateBuild = true } = body;

    if (!url) {
      return NextResponse.json({ ok: false, error: 'url is required' }, { status: 400 });
    }

    stageLogs.push(logStage('crawl_start'));

    let crawlResult;
    await logProjectStep({
      projectId: 'pending',
      userId,
      runId,
      operation: 'generation',
      step: 'crawl_started',
      status: 'started',
      level: 'info',
      message: `Starting website crawl: ${url}`,
    });
    try {
      crawlResult = await crawlWebsite(url, { useHeadless: true });
    } catch (error) {
      stageLogs.push(logStage('crawl_failed'));
      await logProjectStep({
        projectId: 'pending',
        userId,
        runId,
        operation: 'generation',
        step: 'crawl_failed',
        status: 'failed',
        level: 'error',
        message: `Crawl failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: safeError(error),
      });
      return NextResponse.json({
        ok: false,
        error: `Crawler failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'crawl_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
      }, { status: 500 });
    }
    stageLogs.push(logStage('crawl_done', Date.now() - startTime));
    await logProjectStep({
      projectId: 'pending',
      userId,
      runId,
      operation: 'generation',
      step: 'crawl_completed',
      status: 'success',
      level: 'info',
      message: `Crawl completed: ${crawlResult.pages.length} pages, domain: ${crawlResult.domain}`,
      metadata: { pageCount: crawlResult.pages.length, domain: crawlResult.domain, warnings: crawlResult.warnings },
    });

    stageLogs.push(logStage('factual_extraction_start'));

    let factualData: FactualSiteData;
    try {
      const factualResult = await extractFactualSiteDataAgent(crawlResult, instruction, stageLogs);
      factualData = factualResult.data;
      stageLogs = factualResult.stageLogs;
    } catch (error) {
      stageLogs.push(logStage('factual_extraction_failed'));
      return NextResponse.json({
        ok: false,
        error: `Factual extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'factual_extraction_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        crawlWarnings: crawlResult.warnings,
      }, { status: 500 });
    }

    const limitedInput = buildLimitedPromptInput(crawlResult);
    const llmClient = getLLMClient();

    stageLogs.push(logStage('business_profile_start'));

    let businessProfile: BusinessProfile;
    try {
      const profileResult = await llmClient.generateJSON<BusinessProfile>({
        system: "You are a website migration analyst. Extract factual business information from crawled website text. Return only structured JSON matching the schema. If a field is missing, use an empty string or empty array. Do not invent phone/email/location if missing.",
        prompt: buildExtractProfilePrompt(
          crawlResult.normalizedSourceUrl,
          limitedInput.pageTitles,
          limitedInput.pageTexts,
          instruction,
          limitedInput.signalsSummary
        ),
        schema: businessProfileSchema,
      });
      businessProfile = requireGenerateJsonResult(profileResult, 'Business profile extraction');
    } catch (error) {
      stageLogs.push(logStage('business_profile_failed'));
      return NextResponse.json({
        ok: false,
        error: `LLM profile extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'profile_extraction_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        crawlerWarning: limitedInput.warning,
        crawlWarnings: crawlResult.warnings,
      }, { status: 500 });
    }
    stageLogs.push(logStage('business_profile_done', Date.now() - startTime));

    stageLogs.push(logStage('website_plan_start'));

    let websitePlan;
    let planWarnings;
    try {
      const planResult = await proposeWebsitePlanFromCrawlAgent({
        factualSiteData: factualData,
        businessProfile,
        crawlSummary: buildCrawlSummaryForPlan(crawlResult),
        revisionInstruction: instruction,
      });
      websitePlan = planResult.data;
      planWarnings = validateClonePlanWarnings(websitePlan, factualData);
    } catch (error) {
      stageLogs.push(logStage('website_plan_failed'));
      return NextResponse.json({
        ok: false,
        error: `LLM website plan generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'plan_generation_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        businessProfile,
        factualData,
        crawlerWarning: limitedInput.warning,
        crawlWarnings: crawlResult.warnings,
      }, { status: 500 });
    }
    stageLogs.push(logStage('website_plan_done', Date.now() - startTime));

    const fidelityResult = {
      passed: true,
      issues: [...planWarnings.warnings, ...planWarnings.suggestions],
      criticalIssues: [] as string[],
      warnIssues: planWarnings.warnings,
      hasCriticalFailures: false,
    };
    stageLogs.push(logStage('clone_plan_warnings_done', Date.now() - startTime));

    const intake = resolveCloneIntake(factualData, businessProfile);
    const template = selectTemplateAgent(businessProfile);
    const name = projectName || businessProfile.businessName || 'generated-website';

    stageLogs.push(logStage('build_from_plan_start'));

    let siteSpec;
    let generated;
    let uniqueName;
    let buildValidation: { ok: boolean; tempDir: string; logs: string; errors: string[]; durationMs: number } | null = null;

    try {
      const planBuild = await buildWebsiteFromPlan({
        websitePlan,
        intake,
        projectName: name,
        categoryPresetId: template.category,
        validateBuild,
        factualSiteData: factualData,
        logPrefix: 'LEGACY-CLONE',
      });

      if (!planBuild.ok || !planBuild.generated || !planBuild.siteSpec) {
        stageLogs.push(logStage('build_from_plan_failed'));
        return NextResponse.json({
          ok: false,
          error: planBuild.error || 'Build from plan failed',
          stage: planBuild.stage || 'build_from_plan_failed',
          stageLogs,
          duration_ms: Date.now() - startTime,
          businessProfile,
          websitePlan,
          contentFidelity: fidelityResult,
          crawlerWarning: limitedInput.warning,
          crawlWarnings: crawlResult.warnings,
        }, { status: 500 });
      }

      siteSpec = planBuild.siteSpec;
      generated = planBuild.generated;
      uniqueName = planBuild.uniqueName || generateUniqueProjectName(name);
      if (planBuild.generatedSiteValidation) {
        buildValidation = {
          ok: planBuild.generatedSiteValidation.ok,
          tempDir: planBuild.generatedSiteValidation.tempDir,
          logs: planBuild.generatedSiteValidation.logs,
          errors: planBuild.generatedSiteValidation.errors,
          durationMs: planBuild.generatedSiteValidation.durationMs,
        };
      }
    } catch (error) {
      stageLogs.push(logStage('build_from_plan_failed'));
      return NextResponse.json({
        ok: false,
        error: `Build from plan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'build_from_plan_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        businessProfile,
        websitePlan,
        crawlerWarning: limitedInput.warning,
        crawlWarnings: crawlResult.warnings,
      }, { status: 500 });
    }
    stageLogs.push(logStage('build_from_plan_done', Date.now() - startTime));

    stageLogs.push(logStage('validate_files_start'));

    const validationErrors = validateGeneratedFiles(generated.files);
    if (validationErrors.length > 0) {
      stageLogs.push(logStage('validate_files_failed'));
      const errorList = validationErrors.map(e => `${e.file}: ${e.error}`).join('; ');
      return NextResponse.json({
        ok: false,
        error: `Generated file validation failed: ${errorList}`,
        stage: 'validate_files_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        businessProfile,
        siteSpec,
        validationErrors,
        crawlerWarning: limitedInput.warning,
        crawlWarnings: crawlResult.warnings,
      }, { status: 500 });
    }
    stageLogs.push(logStage('validate_files_done', Date.now() - startTime));

    if (validateBuild && buildValidation && !buildValidation.ok) {
      stageLogs.push(logStage('build_gate_failed'));
      return NextResponse.json({
        ok: false,
        error: `Generated site build validation failed: ${buildValidation.errors.join('; ')}`,
        stage: 'generated_site_validation_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        businessProfile,
        siteSpec,
        generatedSiteValidation: buildValidation,
        crawlerWarning: limitedInput.warning,
        crawlWarnings: crawlResult.warnings,
      }, { status: 500 });
    }
    if (validateBuild) {
      stageLogs.push(logStage('build_gate_done', Date.now() - startTime));
    }

    stageLogs.push(logStage('gitlab_project_start'));

    let gitlabResult;
    try {
      await logProjectStep({
        projectId: projectId,
        userId,
        runId,
        operation: 'gitlab',
        step: 'gitlab_project_started',
        status: 'started',
        level: 'info',
        message: `Creating GitLab project: ${uniqueName}`,
        metadata: { projectName: uniqueName },
      });
      gitlabResult = await createGitLabProject({ name: uniqueName });
    } catch (error) {
      stageLogs.push(logStage('gitlab_project_failed'));
      await logProjectStep({
        projectId: projectId,
        userId,
        runId,
        operation: 'gitlab',
        step: 'gitlab_project_failed',
        status: 'failed',
        level: 'error',
        message: `GitLab project creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: safeError(error),
      });
      return NextResponse.json({
        ok: false,
        error: `GitLab project creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'gitlab_project_creation_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        businessProfile,
        siteSpec,
        crawlerWarning: limitedInput.warning,
        crawlWarnings: crawlResult.warnings,
      }, { status: 500 });
    }
    stageLogs.push(logStage('gitlab_project_created', Date.now() - startTime));

    stageLogs.push(logStage('gitlab_commit_start'));

    try {
      await commitFilesToGitLab({
        projectId: gitlabResult.id,
        commitMessage: 'Initial commit: generated website files',
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
        businessProfile,
        siteSpec,
        gitlab: { projectId: gitlabResult.id, repoUrl: gitlabResult.web_url },
        crawlerWarning: limitedInput.warning,
        crawlWarnings: crawlResult.warnings,
      }, { status: 500 });
    }
    stageLogs.push(logStage('gitlab_commit_done', Date.now() - startTime));

    let vercelResult = null;
    let deploymentStatus: 'triggered' | 'trigger_failed' | 'failed' | 'pending' = 'pending';
    let vercelNote = 'Deployment may take 1-3 minutes after Vercel imports/builds the GitLab repo.';

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
      vercelNote = `Vercel project creation failed: ${error instanceof Error ? error.message : 'Unknown error'}. Use manual import: copy the GitLab repo URL and paste into Vercel.`;
      stageLogs.push(logStage('vercel_deploy_failed'));
    }

    // All succeeded — save to MongoDB
    const project = new WebsiteProject({
      ownerId: new mongoose.Types.ObjectId(userId),
      mode: 'clone',
      name: businessProfile.businessName || name,
      sourceUrl: url,
      siteSpec: siteSpec as any,
      businessProfile: businessProfile as any,
      factualSiteData: factualData as any,
      template: {
        category: template.category,
        variant: template.variant,
        reason: template.reason,
      },
      generatedSiteValidation: buildValidation ? { ok: buildValidation.ok, logs: buildValidation.logs, errors: buildValidation.errors, durationMs: buildValidation.durationMs } : undefined,
      contentFidelity: { passed: fidelityResult.passed, issues: fidelityResult.issues },
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
    projectId = project._id.toString();

    // Record the creation action
    const action = new ProjectAction({
      projectId: project._id,
      ownerId: new mongoose.Types.ObjectId(userId),
      type: 'clone_created',
      status: 'succeeded',
      input: { url, instruction, projectName },
      output: {
        gitlabProjectId: gitlabResult.id,
        deploymentStatus,
        businessProfile: businessProfile as any,
        factualData: factualData as any,
      },
    });
    await action.save();

    return NextResponse.json({
      ok: true,
      stage: deploymentStatus === 'triggered' ? 'repo_and_deployment_triggered' : 'repo_created_vercel_trigger_failed',
      stageLogs,
      duration_ms: Date.now() - startTime,
      projectId: project._id.toString(),
      businessProfile,
      factualData,
      siteSpec,
      websitePlan,
      generatedSummary: generated.summary,
      contentFidelity: fidelityResult,
      generatedSiteValidation: buildValidation,
      gitlab: {
        projectId: gitlabResult.id,
        repoUrl: gitlabResult.web_url,
        httpUrlToRepo: gitlabResult.http_url_to_repo,
      },
      deployment: project.deployment,
      template: {
        category: template.category,
        variant: template.variant,
        reason: template.reason,
      },
      crawlerWarning: limitedInput.warning,
      crawlWarnings: crawlResult.warnings,
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