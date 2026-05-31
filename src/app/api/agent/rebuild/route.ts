import { NextRequest, NextResponse } from 'next/server';
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
import { generateSafeFallbackWebsiteFiles } from '@/lib/builder/templates';
import { selectTemplateAgent } from '@/lib/agent/selectTemplateAgent';
import { categoryMicrocopy } from '@/lib/builder/themePresets';
import { createGitLabProject } from '@/lib/gitlab/createProject';
import { commitFilesToGitLab } from '@/lib/gitlab/commitFiles';
import { createVercelProject } from '@/lib/vercel/createVercelProject';
import type { BusinessSignals } from '@/lib/crawler/types';

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
  console.log(`[REBUILD] Stage: ${stage}${duration_ms !== undefined ? ` (${duration_ms}ms)` : ''}`);
  return entry;
}

function computeGitLabPagesUrl(httpUrlToRepo: string): string | null {
  const match = httpUrlToRepo.match(/https:\/\/gitlab\.com\/(.+)\/([^/]+)\.git$/);
  if (!match) return null;
  const [, namespace, project] = match;
  return `https://${namespace}.gitlab.io/${project}/`;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Build limited prompt input from rich crawl result.
 * Prioritizes global signals, homepage, then service/contact/about pages.
 */
function buildLimitedPromptInput(crawlResult: Awaited<ReturnType<typeof crawlWebsite>>): {
  pageTitles: string[];
  pageTexts: string[];
  totalLength: number;
  warning?: string;
} {
  const { pages, globalSignals, siteSummary } = crawlResult;

  // Build rich page entries
  const pageEntries: { url: string; title: string; headings: string[]; text: string; signals: BusinessSignals }[] = [];

  for (const page of pages) {
    const headings = [...page.h1, ...page.h2, ...page.h3].filter(Boolean);
    pageEntries.push({
      url: page.url,
      title: page.title,
      headings,
      text: page.visibleText,
      signals: page.businessSignals,
    });
  }

  // Prioritize: homepage first, then service/contact/about pages
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

  // Build global signals summary
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

  // Build page texts with headings
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

  // Truncate
  const signalsLen = signalsSummary.length;
  const remaining = MAX_TOTAL_TEXT_LENGTH - signalsLen - 100;
  const perPageLimit = Math.floor(remaining / pageTexts.length);
  const truncatedTexts = pageTexts.map(t => truncateText(t, perPageLimit));

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

  try {
    const body = await request.json();
    const { url, instruction, projectName, validateBuild = true } = body;

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    stageLogs.push(logStage('crawl_start'));

    let crawlResult;
    try {
      crawlResult = await crawlWebsite(url, { useHeadless: true });
    } catch (error) {
      stageLogs.push(logStage('crawl_failed'));
      return NextResponse.json({
        error: `Crawler failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'crawl_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
      }, { status: 500 });
    }
    stageLogs.push(logStage('crawl_done', Date.now() - startTime));

    // STEP 1: Extract factual data from crawled website (no LLM creative rewriting)
    let factualData: FactualSiteData;
    try {
      const factualResult = await extractFactualSiteDataAgent(crawlResult, instruction, stageLogs);
      factualData = factualResult.data;
      stageLogs = factualResult.stageLogs;
    } catch (error) {
      stageLogs.push(logStage('factual_extraction_failed'));
      return NextResponse.json({
        error: `Factual extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'factual_extraction_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        crawlWarnings: crawlResult.warnings,
      }, { status: 500 });
    }

    // Build limited prompt input with rich context
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

    // STEP: Validate content fidelity before committing
    stageLogs.push(logStage('content_fidelity_check_start'));
    const fidelityResult = validateContentFidelity(siteSpec, factualData);
    stageLogs.push(logStage('content_fidelity_check_done', Date.now() - startTime));

    if (!fidelityResult.passed) {
      stageLogs.push(logStage('content_fidelity_failed'));
      return NextResponse.json({
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
      // Fall back to default design brief based on industry
      designBrief = getDefaultDesignBrief(businessProfile.industry.toLowerCase().includes('legal') ? 'legal' :
        businessProfile.industry.toLowerCase().includes('health') ? 'healthcare' :
        businessProfile.industry.toLowerCase().includes('restaurant') ? 'restaurant' :
        businessProfile.industry.toLowerCase().includes('plumb') || businessProfile.industry.toLowerCase().includes('hvac') ? 'home-services' : 'general-service');
      console.error(`[REBUILD] Design brief generation failed, using default: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    stageLogs.push(logStage('design_brief_done', Date.now() - startTime));

    // STEP: Select template based on business profile
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

    // Validate generated files before committing to GitLab
    stageLogs.push(logStage('validate_files_start'));

    const validationErrors = validateGeneratedFiles(generated.files);
    if (validationErrors.length > 0) {
      stageLogs.push(logStage('validate_files_failed'));
      const errorList = validationErrors.map(e => `${e.file}: ${e.error}`).join('; ');
      return NextResponse.json({
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

    // BUILD GATE: validate generated site builds successfully before committing
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
        // Build failed - do not commit, do not deploy
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
      gitlabResult = await createGitLabProject({ name: uniqueName });
    } catch (error) {
      stageLogs.push(logStage('gitlab_project_failed'));
      return NextResponse.json({
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
        error: `GitLab commit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'gitlab_commit_failed',
        stageLogs,
        duration_ms: Date.now() - startTime,
        businessProfile,
        siteSpec,
        gitlab: {
          projectId: gitlabResult.id,
          repoUrl: gitlabResult.web_url,
        },
        crawlerWarning: limitedInput.warning,
        crawlWarnings: crawlResult.warnings,
      }, { status: 500 });
    }
    stageLogs.push(logStage('gitlab_commit_done', Date.now() - startTime));

    // Try to create Vercel project for live preview
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

    return NextResponse.json({
      ok: true,
      stage: deploymentStatus === 'triggered' ? 'repo_and_deployment_triggered' : 'repo_created_vercel_trigger_failed',
      stageLogs,
      duration_ms: Date.now() - startTime,
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
      deployment: vercelResult ? {
        provider: vercelResult.provider,
        status: vercelResult.status,
        ready: false, // Always false initially - Vercel needs time to build
        projectId: vercelResult.projectId,
        projectUrl: vercelResult.projectUrl,
        vercelProjectName: vercelResult.vercelProjectName,
        deployHookCreated: vercelResult.deployHookCreated,
        deployTriggered: vercelResult.deployTriggered,
        deployHookId: vercelResult.deployHookId,
        deployHookUrl: vercelResult.deployHookUrl,
        triggeredAt: vercelResult.triggeredAt,
        expectedProductionUrl: vercelResult.expectedProductionUrl,
        liveUrl: null, // Set only after Vercel returns READY
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
      error: message,
      stage: 'unknown_error',
      stageLogs,
      duration_ms: Date.now() - startTime,
    }, { status: 500 });
  }
}