/**
 * Dump clone review_ready artifacts and build-preview inputs for a URL.
 * Usage: node --env-file=.env --import tsx scripts/dump-clone-build-preview-input.ts [url]
 */
import { crawlWebsite } from '../src/lib/crawler/crawlWebsite';
import { getLLMClient } from '../src/lib/llm/llmClient';
import { businessProfileSchema, type BusinessProfile, type FactualSiteData } from '../src/lib/agent/schemas';
import { buildExtractProfilePrompt, extractBusinessProfilePrompt } from '../src/lib/agent/prompts';
import { extractFactualSiteDataAgent } from '../src/lib/agent/extractFactualSiteDataAgent';
import { proposeWebsitePlanFromCrawlAgent } from '../src/lib/agent/proposeWebsitePlanFromCrawlAgent';
import { validateClonePlanWarnings } from '../src/lib/agent/validateClonePlanWarnings';
import { selectTemplateAgent } from '../src/lib/agent/selectTemplateAgent';
import { buildCloneCrawlPromptInput, buildCrawlSummaryForPlan } from '../src/lib/clone/buildCloneCrawlPromptInput';
import { resolveCloneIntake } from '../src/lib/clone/resolveCloneIntake';
import { websitePlanToReviewCard } from '../src/lib/clone/planReviewAdapter';
import { convertPlanToSiteSpec } from '../src/lib/agent/convertPlanToSiteSpec';

const sourceUrl =
  process.argv[2]?.trim() ||
  'https://www.varsityzone.com/galleria-uptown-tx/';

async function main() {
  console.error(`Crawling ${sourceUrl} ...`);
  const crawlResult = await crawlWebsite(sourceUrl, { useHeadless: true });
  console.error(`Pages: ${crawlResult.siteSummary.pageCount}`);

  const factualResult = await extractFactualSiteDataAgent(crawlResult, '', []);
  const factualSiteData = factualResult.data as FactualSiteData;

  const limitedInput = buildCloneCrawlPromptInput(crawlResult);
  const llmClient = getLLMClient();
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
  const businessProfile = profileResult.data;

  const crawlSummary = buildCrawlSummaryForPlan(crawlResult);
  const planResult = await proposeWebsitePlanFromCrawlAgent({
    factualSiteData,
    businessProfile,
    crawlSummary,
  });
  const websitePlan = planResult.data;
  const planWarnings = validateClonePlanWarnings(websitePlan, factualSiteData);
  const suggestedTemplate = selectTemplateAgent(businessProfile);
  const intake = resolveCloneIntake(factualSiteData, businessProfile);
  const siteSpecPreview = convertPlanToSiteSpec(websitePlan, intake);

  const reviewReadyJob = {
    status: 'review_ready',
    sourceUrl: crawlResult.normalizedSourceUrl,
    crawlSummary: {
      totalDiscovered: crawlResult.pages.length,
      totalCrawled: crawlResult.pages.length,
      pageCount: crawlResult.siteSummary.pageCount,
    },
    factualSiteData,
    businessProfile,
    proposedWebsitePlan: websitePlan,
    suggestedTemplate,
    contentFidelity: {
      passed: true,
      issues: [...planWarnings.warnings, ...planWarnings.suggestions],
      criticalIssues: [],
      warnIssues: planWarnings.warnings,
      hasCriticalFailures: false,
    },
    reviewChecklistCard: websitePlanToReviewCard(websitePlan),
  };

  const buildPreviewInput = {
    websitePlan,
    intake,
    projectName: websitePlan.businessName || 'generated-site',
    layoutStarterId: suggestedTemplate.category ? undefined : undefined,
    categoryPresetId: suggestedTemplate.category,
    validateBuild: true,
    factualSiteData,
    logPrefix: 'CLONE-BUILD-PREVIEW',
  };

  const output = {
    reviewReadyJob,
    buildPreviewFeeds: {
      buildWebsiteFromPlanInput: buildPreviewInput,
      derivedSiteSpecBeforeDesignBrief: siteSpecPreview,
      llmStepsInsideBuildWebsiteFromPlan: [
        'validateScratchContent(websitePlan, intake)',
        'validateScratchFidelity(websitePlan, intake, { factualSiteData })',
        'convertPlanToSiteSpec(websitePlan, intake) → siteSpec',
        'generateDesignBriefAgent(businessProfile-ish, siteSpec) → designBrief LLM prompt',
        'generateWebsiteFiles(siteSpec, uniqueName, designBrief, template, layoutStarter)',
        'validateGeneratedSite(files) npm build gate',
      ],
      note: 'Build preview does NOT re-crawl or re-plan. It reads job fields from Mongo and calls buildWebsiteFromPlan once.',
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
