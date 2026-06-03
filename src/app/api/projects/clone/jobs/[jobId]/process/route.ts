import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob, type ICrawlPage } from '@/lib/db/models/CloneJob';
import { crawlWebsite, type CrawlProgressEvent } from '@/lib/crawler/crawlWebsite';
import { getLLMClient } from '@/lib/llm/llmClient';
import { businessProfileSchema, siteSpecSchema, type BusinessProfile, type SiteSpec, type FactualSiteData } from '@/lib/agent/schemas';
import { buildExtractProfilePrompt, extractBusinessProfilePrompt, buildGenerateSiteSpecPrompt } from '@/lib/agent/prompts';
import { extractFactualSiteDataAgent } from '@/lib/agent/extractFactualSiteDataAgent';
import { validateContentFidelity } from '@/lib/agent/validateContentFidelity';
import { generateDesignBriefAgent, getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import { selectTemplateAgent } from '@/lib/agent/selectTemplateAgent';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

function log(job: any, stage: string, message: string, data?: unknown) {
  job.logs.push({ timestamp: new Date(), stage, message, data });
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

  // If already past queued, just return current state
  if (job.status !== 'queued') {
    return NextResponse.json({ ok: true, jobId: job._id.toString(), status: job.status, currentStageLabel: job.currentStageLabel, progressPercent: job.progressPercent });
  }

  try {
    // ── PHASE 1: CRAWLING ──────────────────────────────────────────────
    job.status = 'crawling';
    job.currentStageLabel = 'Crawling website pages...';
    job.progressPercent = 5;
    await job.save();

    log(job, 'crawling', 'Starting website crawl');

    const crawlResult = await crawlWebsite(
      job.sourceUrl,
      { useHeadless: true },
      async function onProgress(event: CrawlProgressEvent) {
  const update: any = { currentStageLabel: 'Crawling website pages...' };
  if (event.type === 'page_discovered') {
    await CloneJob.updateOne(
      { _id: job._id },
      {
        $push: { crawlPages: { url: event.url, status: 'queued' } },
        $set: { currentStageLabel: 'Crawling website pages...' },
      }
    );
  } else if (event.type === 'page_started') {
    const existing = job.crawlPages.find((p: ICrawlPage) => p.url === event.url);
    if (existing) {
      await CloneJob.updateOne(
        { _id: job._id, 'crawlPages.url': event.url },
        { $set: { 'crawlPages.$.status': 'crawling', 'crawlPages.$.startedAt': new Date() } }
      );
    } else {
      await CloneJob.updateOne(
        { _id: job._id },
        { $push: { crawlPages: { url: event.url, status: 'crawling', startedAt: new Date() } } }
      );
    }
  } else if (event.type === 'page_done') {
    await CloneJob.updateOne(
      { _id: job._id, 'crawlPages.url': event.url },
      { $set: {
        'crawlPages.$.status': 'done',
        'crawlPages.$.title': event.title,
        'crawlPages.$.statusCode': event.statusCode,
        'crawlPages.$.textLength': event.textLength,
        'crawlPages.$.completedAt': new Date(),
      }}
    );
  } else if (event.type === 'page_failed') {
    await CloneJob.updateOne(
      { _id: job._id, 'crawlPages.url': event.url },
      { $set: { 'crawlPages.$.status': 'failed', 'crawlPages.$.error': event.error } }
    );
  }

  // Update progress periodically
  const crawlPages = await CloneJob.findById(job._id).select('crawlPages');
  const done = crawlPages?.crawlPages.filter((p: ICrawlPage) => p.status === 'done').length ?? 0;
  const progressPercent = Math.min(45, 5 + done * 4);
  await CloneJob.updateOne(
    { _id: job._id },
    { $set: { progressPercent, currentStageLabel: 'Crawling website pages...' } }
  );
}
    );

    log(job, 'crawling', `Crawl complete. ${crawlResult.pages.length} pages crawled, ${crawlResult.siteSummary.discoveredInternalLinks} links found.`);
    job.progressPercent = 45;
    await job.save();

    // ── PHASE 2: EXTRACTION ────────────────────────────────────────────
    job.status = 'extracting';
    job.currentStageLabel = 'Extracting business facts...';
    await job.save();

    log(job, 'extracting', 'Starting factual data extraction');

    const factualResult = await extractFactualSiteDataAgent(crawlResult, '', []);
    job.factualSiteData = factualResult.data as any;
    log(job, 'extracting', 'Factual data extracted');

    // Build limited prompt input for profile extraction
    const limitedInput = buildLimitedPromptInput(crawlResult);
    const llmClient = getLLMClient();

    log(job, 'extracting', 'Starting business profile extraction');
    const profileResult = await llmClient.generateJSON<BusinessProfile>({
      system: extractBusinessProfilePrompt.system,
      prompt: buildExtractProfilePrompt(
        crawlResult.normalizedSourceUrl,
        limitedInput.pageTitles,
        limitedInput.pageTexts,
        '',
        limitedInput.signalsSummary
      ),
      schema: businessProfileSchema,
    });
    job.businessProfile = profileResult.data as any;
    log(job, 'extracting', 'Business profile extracted');

    // ── PHASE 3: PLANNING ──────────────────────────────────────────────
    job.status = 'planning';
    job.currentStageLabel = 'Preparing proposed website plan...';
    job.progressPercent = 65;
    await job.save();

    log(job, 'planning', 'Generating proposed website plan');

    const specResult = await llmClient.generateJSON<SiteSpec>({
      system: "You are a website modernization agent. You may improve structure, clarity, visual hierarchy, and CTA wording, but you MUST preserve factual accuracy. Use only factualData as source of truth. Return only JSON matching the schema.",
      prompt: buildGenerateSiteSpecPrompt(
        job.businessProfile as Record<string, unknown>,
        job.factualSiteData as Record<string, unknown>,
        ''
      ),
      schema: siteSpecSchema,
    });
    const proposedSiteSpec = specResult.data;
    job.proposedWebsitePlan = proposedSiteSpec as any;
    log(job, 'planning', 'Proposed site spec generated');

    // Content fidelity check
    const fidelityResult = validateContentFidelity(proposedSiteSpec, job.factualSiteData as FactualSiteData);
    job.contentFidelity = {
      passed: fidelityResult.passed,
      issues: fidelityResult.issues,
      criticalIssues: fidelityResult.criticalIssues,
      warnIssues: fidelityResult.warnIssues,
      hasCriticalFailures: fidelityResult.hasCriticalFailures,
    };
    log(job, 'planning', `Content fidelity: ${fidelityResult.passed ? 'passed' : 'critical issues: ' + fidelityResult.criticalIssues.join(', ')}`);

    // Template: keep owner color/layout from clone start or review; otherwise AI suggestion
    const { isOwnerChosenTemplate } = await import('@/lib/builder/ownerTemplateSelection');
    const ownerLayoutStarterId = job.suggestedTemplate?.layoutStarterId;
    if (isOwnerChosenTemplate(job.suggestedTemplate?.reason) && job.suggestedTemplate?.variant) {
      log(job, 'planning', `Using owner theme: ${job.suggestedTemplate.category} / ${job.suggestedTemplate.variant}`);
      if (ownerLayoutStarterId) {
        job.suggestedTemplate = {
          ...job.suggestedTemplate,
          layoutStarterId: ownerLayoutStarterId,
        };
        log(job, 'planning', `Using owner layout: ${ownerLayoutStarterId}`);
      }
    } else {
      const template = selectTemplateAgent(job.businessProfile as BusinessProfile);
      job.suggestedTemplate = {
        category: template.category,
        variant: template.variant,
        reason: template.reason,
        layoutStarterId: ownerLayoutStarterId,
      };
      log(job, 'planning', `Suggested template: ${template.category} / ${template.variant}`);
    }

    job.status = 'review_ready';
    job.currentStageLabel = 'Review the proposed website before building.';
    job.progressPercent = 48;
    await job.save();

    return NextResponse.json({
      ok: true,
      jobId: job._id.toString(),
      status: job.status,
      currentStageLabel: job.currentStageLabel,
      progressPercent: job.progressPercent,
    });
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    job.currentStageLabel = 'Something went wrong.';
    log(job, 'failed', `Job failed: ${job.error}`);
    await job.save();

    return NextResponse.json({
      ok: false,
      error: job.error,
      stage: 'job_failed',
    }, { status: 500 });
  }
}

function buildLimitedPromptInput(crawlResult: any): {
  pageTitles: string[];
  pageTexts: string[];
  totalLength: number;
  warning?: string;
  signalsSummary: string;
} {
  const MAX_TOTAL_TEXT_LENGTH = 12000;
  const { pages, globalSignals, siteSummary } = crawlResult;

  const pageEntries = pages.map((page: any) => ({
    url: page.url,
    title: page.title,
    headings: [...(page.h1 || []), ...(page.h2 || []), ...(page.h3 || [])].filter(Boolean),
    text: page.visibleText,
    signals: page.businessSignals,
  }));

  const priorityKeywords = ['service', 'about', 'contact', 'pricing', 'menu', 'faq', 'team'];
  const sorted = [...pageEntries].sort((a: any, b: any) => {
    const aHigh = priorityKeywords.some((k: string) => a.url.toLowerCase().includes(k));
    const bHigh = priorityKeywords.some((k: string) => b.url.toLowerCase().includes(k));
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
    return { pageTitles, pageTexts: [signalsSummary, ...pageTexts], totalLength, signalsSummary };
  }

  const signalsLen = signalsSummary.length;
  const remaining = MAX_TOTAL_TEXT_LENGTH - signalsLen - 100;
  const perPageLimit = Math.floor(remaining / pageTexts.length);
  const truncatedTexts = pageTexts.map((t: string) => t.slice(0, perPageLimit));

  return {
    pageTitles,
    pageTexts: [signalsSummary, ...truncatedTexts],
    totalLength: MAX_TOTAL_TEXT_LENGTH,
    warning: `Content truncated to ${MAX_TOTAL_TEXT_LENGTH} chars`,
    signalsSummary,
  };
}