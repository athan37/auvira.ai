import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob, type ICrawlPage } from '@/lib/db/models/CloneJob';
import { crawlWebsite, type CrawlProgressEvent } from '@/lib/crawler/crawlWebsite';
import { getLLMClient } from '@/lib/llm/llmClient';
import { requireGenerateJsonResult } from '@/lib/llm/requireGenerateJsonResult';
import { businessProfileSchema, type BusinessProfile, type FactualSiteData } from '@/lib/agent/schemas';
import { buildExtractProfilePrompt, extractBusinessProfilePrompt } from '@/lib/agent/prompts';
import { extractFactualSiteDataAgent } from '@/lib/agent/extractFactualSiteDataAgent';
import { proposeWebsitePlanFromCrawlAgent } from '@/lib/agent/proposeWebsitePlanFromCrawlAgent';
import { validateClonePlanWarnings } from '@/lib/agent/validateClonePlanWarnings';
import { selectTemplateAgent } from '@/lib/agent/selectTemplateAgent';
import { buildCloneCrawlPromptInput, buildCrawlSummaryForPlan } from '@/lib/clone/buildCloneCrawlPromptInput';
import { applyScratchTemplateSelectionToPlan } from '@/lib/scratch/applyScratchTemplateSelectionToPlan';
import {
  countCloneObservabilityTurns,
  recordCloneObservabilityTurn,
} from '@/lib/observability/recordCloneTurn';
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

  if (job.status !== 'queued') {
    return NextResponse.json({ ok: true, jobId: job._id.toString(), status: job.status, currentStageLabel: job.currentStageLabel, progressPercent: job.progressPercent });
  }

  try {
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

    job.status = 'extracting';
    job.currentStageLabel = 'Extracting business facts...';
    await job.save();

    log(job, 'extracting', 'Starting factual data extraction');

    const factualResult = await extractFactualSiteDataAgent(crawlResult, '', []);
    job.factualSiteData = factualResult.data as any;
    log(job, 'extracting', 'Factual data extracted');

    const limitedInput = buildCloneCrawlPromptInput(crawlResult);
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
    job.businessProfile = requireGenerateJsonResult(profileResult, 'Business profile extraction') as any;
    log(job, 'extracting', 'Business profile extracted');

    job.status = 'planning';
    job.currentStageLabel = 'Preparing proposed website plan...';
    job.progressPercent = 65;
    await job.save();

    log(job, 'planning', 'Generating proposed website plan from crawl');

    const crawlSummary = buildCrawlSummaryForPlan(crawlResult);
    const planResult = await proposeWebsitePlanFromCrawlAgent({
      factualSiteData: job.factualSiteData as FactualSiteData,
      businessProfile: job.businessProfile as BusinessProfile,
      crawlSummary,
    });

    let websitePlan = planResult.data;
    const planWarnings = validateClonePlanWarnings(websitePlan, job.factualSiteData as FactualSiteData);
    job.proposedWebsitePlan = websitePlan as any;
    log(job, 'planning', `Proposed website plan generated (${planWarnings.warnings.length} review warnings)`);

    job.contentFidelity = {
      passed: true,
      issues: [...planWarnings.warnings, ...planWarnings.suggestions],
      criticalIssues: [],
      warnIssues: planWarnings.warnings,
      hasCriticalFailures: false,
    };

    const { isOwnerChosenTemplate } = await import('@/lib/builder/ownerTemplateSelection');
    const ownerLayoutStarterId = job.suggestedTemplate?.layoutStarterId;
    if (isOwnerChosenTemplate(job.suggestedTemplate?.reason) && job.suggestedTemplate?.variant) {
      log(job, 'planning', `Using owner theme: ${job.suggestedTemplate.category} / ${job.suggestedTemplate.variant}`);
      websitePlan = applyScratchTemplateSelectionToPlan(websitePlan, {
        layoutStarterId: ownerLayoutStarterId,
        templateCategory: job.suggestedTemplate.category,
        templateVariant: job.suggestedTemplate.variant,
      });
      job.proposedWebsitePlan = websitePlan as any;
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

    const observabilityMeta = await recordCloneObservabilityTurn({
      jobId: job._id.toString(),
      projectTitle: job.projectName || job.sourceUrl || 'Clone job',
      phase: 'process',
      turnId: `${job._id.toString()}-process`,
      turnIndex: countCloneObservabilityTurns(job.logs) + 1,
      userMessage: `Generate site plan from ${job.sourceUrl}`,
      reply: planWarnings.warnings.length
        ? `Proposed website plan generated; review warnings: ${planWarnings.warnings.slice(0, 3).join('; ')}`
        : 'Proposed website plan generated.',
      outcome: 'success',
      verifyPass: true,
      siteConfigParsed: {
        businessName: websitePlan.businessName,
        sections: websitePlan.contentPlan?.sections,
      },
      phaseEvents: [
        { name: 'website_plan_llm', durationMs: 0, outcome: 'success' },
        {
          name: 'clone_plan_warnings',
          durationMs: 0,
          outcome: 'passed',
          metadata: { warningCount: planWarnings.warnings.length },
        },
      ],
    });
    if (observabilityMeta) {
      log(job, 'observability', 'Recorded planning turn', {
        traceId: observabilityMeta.arize.externalId,
        grade: observabilityMeta.arize.grade,
        overallScore: observabilityMeta.arize.overallScore,
        syncStatus: observabilityMeta.arize.syncStatus,
      });
    }

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
