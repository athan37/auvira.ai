import { getLLMClient } from '@/lib/llm/llmClient';
import { factualSiteDataSchema, type FactualSiteData } from './schemas';
import type { CrawledSite } from '@/lib/crawler/types';
import { buildCloneCrawlPromptInput } from '@/lib/clone/buildCloneCrawlPromptInput';
import { getCloneCrawlPromptLimits } from '@/lib/clone/crawlPromptLimits';

interface StageLog {
  stage: string;
  timestamp: string;
  duration_ms?: number;
}

function logStage(stageLogs: StageLog[], stage: string, duration_ms?: number): void {
  stageLogs.push({
    stage,
    timestamp: new Date().toISOString(),
    ...(duration_ms !== undefined ? { duration_ms } : {}),
  });
}

function buildFactualExtractionPrompt(
  normalizedSourceUrl: string,
  pageTitles: string[],
  pageTexts: string[],
  instruction?: string
): string {
  return `You are a strict factual website migration extractor.

RULES:
- Extract ONLY facts directly supported by the crawled website text, headings, links, structured data, or metadata.
- Do NOT invent, infer, or substitute generic business details.
- If a field is missing from the source, return an empty string or empty array.
- Never create fake phone numbers, fake emails, fake addresses, fake testimonials, fake awards, fake business names, fake practice areas, or fake claims.
- Every important fact MUST be traceable to sourceFacts.
- Business name must come from the source website only (logo text, h1, title tag, etc.)
- Services/practice areas must come from source headings/text only.
- Testimonials must be copied or lightly shortened from source testimonials only.
- Contact info (phone, email, address) must come from source website only.
- If the original site says family law, do not change it to immigration, personal injury, criminal defense, etc.
- Do not invent awards, BBB ratings, years of experience, case counts, or guarantees.
- If source is missing critical business identity info, document this in missingCriticalFields.

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema. Do not include any explanatory text before or after the JSON.

Source website: ${normalizedSourceUrl}

CRAWLED PAGE DATA:
${pageTitles.map((title, i) => `=== PAGE ${i + 1}: ${title} ===\n${pageTexts[i]}`).join('\n\n')}

${instruction ? `\nUSER INSTRUCTION: ${instruction}\n` : ''}
`;
}

/**
 * Extracts strictly factual data from a crawled website.
 * This is the FIRST step in the pipeline - no LLM creative rewriting allowed here.
 */
export async function extractFactualSiteDataAgent(
  crawlResult: CrawledSite,
  instruction?: string,
  stageLogs?: StageLog[]
): Promise<{ data: FactualSiteData; stageLogs: StageLog[] }> {
  const startTime = Date.now();
  if (!stageLogs) stageLogs = [];

  logStage(stageLogs, 'factual_extraction_start');

  const limits = getCloneCrawlPromptLimits();
  const promptInput = buildCloneCrawlPromptInput(crawlResult, limits.maxFactualChars);
  const pageTitles = promptInput.pageTitles;
  const pageTexts = promptInput.pageTexts;

  logStage(stageLogs, 'factual_extraction_prompt_built', Date.now() - startTime);

  const llmClient = getLLMClient();

  try {
    const result = await llmClient.generateJSON<FactualSiteData>({
      system: "You are a strict factual website migration extractor. Extract only facts directly supported by the crawled website. Return ONLY JSON. No explanatory text.",
      prompt: buildFactualExtractionPrompt(crawlResult.normalizedSourceUrl, pageTitles, pageTexts, instruction),
      schema: factualSiteDataSchema,
    });

    logStage(stageLogs, 'factual_extraction_done', Date.now() - startTime);

    return {
      data: result.data,
      stageLogs,
    };
  } catch (error) {
    logStage(stageLogs, 'factual_extraction_failed', Date.now() - startTime);
    throw error;
  }
}