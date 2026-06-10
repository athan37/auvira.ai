/**
 * Smoke test: crawl + Gemini LLM steps for varsityzone clone (no MongoDB).
 * Usage: node --env-file=.env -e "require('child_process').execSync('npx --yes tsx scripts/test-varsityzone-clone.ts [url]', {stdio:'inherit'})"
 */

import { crawlWebsite } from '@/lib/crawler/crawlWebsite';
import { extractFactualSiteDataAgent } from '@/lib/agent/extractFactualSiteDataAgent';
import { proposeWebsitePlanFromCrawlAgent } from '@/lib/agent/proposeWebsitePlanFromCrawlAgent';
import { validateClonePlanWarnings } from '@/lib/agent/validateClonePlanWarnings';
import { buildCloneCrawlPromptInput, buildCrawlSummaryForPlan } from '@/lib/clone/buildCloneCrawlPromptInput';
import { buildExtractProfilePrompt, extractBusinessProfilePrompt } from '@/lib/agent/prompts';
import { businessProfileSchema, type BusinessProfile } from '@/lib/agent/schemas';
import { getLLMClient } from '@/lib/llm/llmClient';
import { requireGenerateJsonResult } from '@/lib/llm/requireGenerateJsonResult';

async function main() {
  const sourceUrl =
    process.argv[2] ||
    'https://www.varsityzone.com/galleria-uptown-tx/?gad_source=1&gad_campaignid=23633484129';

  console.log('LLM_PROVIDER:', process.env.LLM_PROVIDER || '(default gemini)');
  console.log('GEMINI_MODEL:', process.env.GEMINI_MODEL || '(default gemini-flash-latest)');
  console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? 'set' : 'MISSING');
  console.log('Source URL:', sourceUrl);
  console.log('');

  console.log('[1/4] Crawling...');
  const crawl = await crawlWebsite(sourceUrl, { useHeadless: true, maxPages: 15 });
  console.log(`  Pages: ${crawl.pages.length}, discovered links: ${crawl.siteSummary.discoveredInternalLinks}`);

  console.log('[2/4] Factual extraction (Gemini)...');
  const factual = await extractFactualSiteDataAgent(crawl, '', []);
  console.log(`  Business: ${factual.data.businessName || '(none)'}`);
  console.log(`  Services: ${factual.data.practiceAreasOrServices?.length ?? 0}`);
  console.log(`  Phones: ${factual.data.phoneNumbers?.length ?? 0}`);

  const limited = buildCloneCrawlPromptInput(crawl);
  const llm = getLLMClient();

  console.log('[3/4] Business profile (Gemini)...');
  const profileResult = await llm.generateJSON<BusinessProfile>({
    system: extractBusinessProfilePrompt.system,
    prompt: buildExtractProfilePrompt(
      crawl.normalizedSourceUrl,
      limited.pageTitles,
      limited.pageTexts,
      '',
      limited.signalsSummary
    ),
    schema: businessProfileSchema,
  });
  const profile = requireGenerateJsonResult(profileResult, 'Business profile extraction');
  console.log(`  Profile business: ${profile.businessName || '(none)'}`);

  console.log('[4/4] Website plan (Gemini)...');
  const planResult = await proposeWebsitePlanFromCrawlAgent({
    factualSiteData: factual.data,
    businessProfile: profile,
    crawlSummary: buildCrawlSummaryForPlan(crawl),
  });
  const warnings = validateClonePlanWarnings(planResult.data, factual.data);
  console.log(`  Plan sections: ${planResult.data.contentPlan?.sections?.length ?? 0}`);
  console.log(`  Warnings: ${warnings.warnings.length}`);

  console.log('\nClone LLM pipeline OK.');
}

main().catch((err) => {
  console.error('\nClone test FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
