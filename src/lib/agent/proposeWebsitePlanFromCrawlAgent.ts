import type { BusinessProfile, FactualSiteData, WebsitePlan } from './schemas';
import { getLLMClient } from '@/lib/llm/llmClient';
import { requireGenerateJsonResult } from '@/lib/llm/requireGenerateJsonResult';
import { websitePlanSchema } from './schemas';
import { buildProposeWebsitePlanFromCrawlPrompt } from './prompts';

interface StageLog {
  stage: string;
  timestamp: string;
  duration_ms?: number;
}

export interface ProposeWebsitePlanFromCrawlInput {
  factualSiteData: FactualSiteData;
  businessProfile: BusinessProfile;
  crawlSummary?: string;
  revisionInstruction?: string;
}

/** Propose a strategic WebsitePlan grounded in crawl-extracted facts (clone pipeline). */
export async function proposeWebsitePlanFromCrawlAgent(
  input: ProposeWebsitePlanFromCrawlInput
): Promise<{ data: WebsitePlan; stageLogs: StageLog[] }> {
  const startTime = Date.now();
  const stageLogs: StageLog[] = [];
  stageLogs.push({ stage: 'crawl_plan_proposal_start', timestamp: new Date().toISOString() });

  const llmClient = getLLMClient();
  const prompt = buildProposeWebsitePlanFromCrawlPrompt(input);

  try {
    const result = await llmClient.generateJSON({
      system:
        'You are a senior website strategist modernizing an existing business website from crawled facts. Improve structure and messaging but never invent factual claims. Return ONLY JSON matching the website plan schema.',
      prompt,
      schema: websitePlanSchema,
    });

    stageLogs.push({
      stage: 'crawl_plan_proposal_done',
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
    });

    return {
      data: requireGenerateJsonResult(result, 'Website plan generation') as WebsitePlan,
      stageLogs,
    };
  } catch (error) {
    stageLogs.push({
      stage: 'crawl_plan_proposal_failed',
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
    });
    throw error;
  }
}
