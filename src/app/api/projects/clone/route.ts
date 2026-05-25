import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';
import { ProjectAction } from '@/models/ProjectAction';
import { crawlWebsite } from '@/lib/crawler/crawlWebsite';
import { getLLMClient } from '@/lib/llm/llmClient';
import { businessProfileSchema, siteSpecSchema, type BusinessProfile, type SiteSpec, type DesignBrief, type FactualSiteData } from '@/lib/agent/schemas';
import { buildExtractProfilePrompt, buildGenerateSiteSpecPrompt } from '@/lib/agent/prompts';
import { extractFactualSiteDataAgent } from '@/lib/agent/extractFactualSiteDataAgent';
import { validateContentFidelity } from '@/lib/agent/validateContentFidelity';
import { generateDesignBriefAgent, getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { validateGeneratedFiles } from '@/lib/builder/validateGeneratedFiles';
import { validateGeneratedSite } from '@/lib/builder/validateGeneratedSite';
import { selectTemplateAgent } from '@/lib/agent/selectTemplateAgent';
import { createGitLabProject } from '@/lib/gitlab/createProject';
import { commitFilesToGitLab } from '@/lib/gitlab/commitFiles';
import { createVercelProject } from '@/lib/vercel/createVercelProject';
import type { BusinessSignals } from '@/lib/crawler/types';
import { createProjectRun, logProjectStep, withProjectStep, safeError } from '@/lib/project-logs/projectLogger';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

const MAX_TOTAL_TEXT_LENGTH = 12000;

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

function buildLimitedPromptInput(crawlResult: Awaited<ReturnType<typeof crawlWebsite>>): {
  pageTitles: string[];
  pageTexts: string[];
  totalLength: number;
  warning?: string;
} {
  const { pages, globalSignals, siteSummary } = crawlResult;

  const pageEntries: { url: string; title: string; headings: string[]; text: string; signals: BusinessSignals }[] = pages.map(page => ({
    url: page.url,
    title: page.title,
    headings: [...page.h1, ...page.h2, ...page.h3].filter(Boolean),
    text: page.visibleText,
    signals: page.businessSignals,
  }));

  const priorityKeywords = ['service', 'about', 'contact', 'pricing', 'menu', 'faq', 'team'];
  const sorted = [...pageEntries].sort((a, b) => {
    const aHigh = priorityKeywords.some(k => a.url.toLowerCase().includes(k));
    const bHigh = priorityKeywords.some(k => b.url.toLowerCase().includes(k));
    if (aHigh && !bHigh) return -1;
    if (!aHigh && bHigh) return 1;
    if (a.url === crawlResult.normalizedSourceUrl) return -1;
    if (b.url === crawlResult.normalizedSourceUrl) return 1;
    return 0;
  });

  const signalsSummary = [
    `Site: ${crawlResult.normalizedSourceUrl}`,
    `Domain: ${crawlResult.domain}`,
    `Pages crawled: ${siteSummary.pageCount}`,
    '',
    `Business name candidates: ${globalSignals.businessNameCandidates.join(', ') || 'not detected'}`,
    `Phone numbers found: ${globalSignals.phoneNumbers.join(', ') || 'not detected'}`,
    `Emails found: ${globalSignals.emails.join(', ') || 'not detected'}`,
    `Addresses found: ${globalSignals.addresses.length > 0 ? globalSignals.addresses.slice(0, 3).join(' | ') : 'not detected'}`,
    `Social links: ${globalSignals.socialLinks.length > 0 ? globalSignals.socialLinks.slice(0, 5).join(', ') : 'none detected'}`,
    `Booking links: ${globalSignals.bookingLinks.length > 0 ? globalSignals.bookingLinks.slice(0, 3).join(', ') : 'none detected'}`,
    `Service keywords: ${globalSignals.serviceKeywords.slice(0, 15).join(', ') || 'not detected'}`,
    `CTA phrases: ${globalSignals.ctaCandidates.slice(0, 10).join(', ') || 'not detected'}`,
  ].join('\n');

  const pageTexts: string[] = [];
  const pageTitles: string[] = [];

  for (const entry of sorted) {
    const header = `[${entry.url}] ${entry.title || '(no title)'}`;
    const headingStr = entry.headings.length > 0 ? `\nHeadings: ${entry.headings.join(' > ')}` : '';
    const signalStr = entry.signals.phoneNumbers.length > 0 || entry.signals.emails.length > 0
      ? `\nContact on this page: ${entry.signals.phoneNumbers.join(', ')} ${entry.signals.emails.join(', ')}`
      : '';
    const text = header + headingStr + signalStr + '\n\n' + entry.text.slice(0, 3000);
    pageTexts.push(text);
    pageTitles.push(entry.title || entry.url);
  }

  const combined = signalsSummary + '\n\n' + pageTexts.join('\n\n');
  const totalLength = combined.length;

  if (totalLength <= MAX_TOTAL_TEXT_LENGTH) {
    return { pageTitles, pageTexts: [signalsSummary, ...pageTexts], totalLength };
  }

  const signalsLen = signalsSummary.length;
  const remaining = MAX_TOTAL_TEXT_LENGTH - signalsLen - 100;
  const perPageLimit = Math.floor(remaining / pageTexts.length);
  const truncatedTexts = pageTexts.map(t => t.slice(0, perPageLimit));

  return {
    pageTitles,
    pageTexts: [signalsSummary, ...truncatedTexts],
    totalLength: MAX_TOTAL_TEXT_LENGTH,
    warning: `Crawler found limited content. (${totalLength} chars, truncated to ${MAX_TOTAL_TEXT_LENGTH})`,
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
        prompt: buildExtractProfilePrompt(crawlResult.normalizedSourceUrl, limitedInput.pageTitles, limitedInput.pageTexts, instruction),
        schema: businessProfileSchema,
      });
      businessProfile = profileResult.data;
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

    stageLogs.push(logStage('site_spec_start'));

    let siteSpec: SiteSpec;
    try {
      const specResult = await llmClient.generateJSON<SiteSpec>({
        system: "You are a website modernization agent. You may improve structure, clarity, visual hierarchy, and CTA wording, but you MUST preserve factual accuracy. Use only factualData as source of truth. Return only JSON matching the schema.",
        prompt: buildGenerateSiteSpecPrompt(
          businessProfile as unknown as Record<string, unknown>,
          factualData as unknown as Record<string, unknown>,
          instruction
        ),
        schema: siteSpecSchema,
      });
      siteSpec = specResult.data;
    } catch (error) {
      stageLogs.push(logStage('site_spec_failed'));
      return NextResponse.json({
        ok: false,
        error: `LLM site spec generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'spec_generation_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        businessProfile,
        factualData: factualData,
        crawlerWarning: limitedInput.warning,
        crawlWarnings: crawlResult.warnings,
      }, { status: 500 });
    }
    stageLogs.push(logStage('site_spec_done', Date.now() - startTime));

    stageLogs.push(logStage('content_fidelity_check_start'));
    const fidelityResult = validateContentFidelity(siteSpec, factualData);
    stageLogs.push(logStage('content_fidelity_check_done', Date.now() - startTime));

    if (!fidelityResult.passed) {
      stageLogs.push(logStage('content_fidelity_failed'));
      return NextResponse.json({
        ok: false,
        error: `Content fidelity check failed: ${fidelityResult.issues.join('; ')}`,
        stage: 'content_fidelity_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        businessProfile,
        factualData,
        siteSpec,
        contentFidelity: fidelityResult,
        crawlerWarning: limitedInput.warning,
        crawlWarnings: crawlResult.warnings,
      }, { status: 500 });
    }

    stageLogs.push(logStage('design_brief_start'));

    let designBrief: DesignBrief;
    try {
      designBrief = await generateDesignBriefAgent(
        businessProfile as unknown as Record<string, unknown>,
        siteSpec as unknown as Record<string, unknown>,
        crawlResult.normalizedSourceUrl
      );
    } catch (error) {
      stageLogs.push(logStage('design_brief_failed'));
      designBrief = getDefaultDesignBrief(
        businessProfile.industry.toLowerCase().includes('legal') ? 'legal' :
        businessProfile.industry.toLowerCase().includes('health') ? 'healthcare' :
        businessProfile.industry.toLowerCase().includes('restaurant') ? 'restaurant' :
        businessProfile.industry.toLowerCase().includes('plumb') || businessProfile.industry.toLowerCase().includes('hvac') ? 'home-services' : 'general-service'
      );
      console.error(`[PROJECTS/CLONE] Design brief generation failed, using default: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    stageLogs.push(logStage('design_brief_done', Date.now() - startTime));

    const template = selectTemplateAgent(businessProfile);

    const name = projectName || businessProfile.businessName || 'generated-website';
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
        businessProfile,
        siteSpec,
        crawlerWarning: limitedInput.warning,
        crawlWarnings: crawlResult.warnings,
      }, { status: 500 });
    }
    stageLogs.push(logStage('build_files_done', Date.now() - startTime));

    stageLogs.push(logStage('validate_files_start'));

    const validationErrors = validateGeneratedFiles(siteSpec, uniqueName);
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
          error: `Generated site build validation failed: ${buildResult.errors.join('; ')}`,
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
      designBrief,
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