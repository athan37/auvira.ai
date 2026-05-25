import { getLLMClient } from '@/lib/llm/llmClient';
import { factualSiteDataSchema, type FactualSiteData } from './schemas';
import type { CrawledSite } from '@/lib/crawler/types';

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

  // Build limited prompt input
  const pageTitles: string[] = [];
  const pageTexts: string[] = [];

  // Sort pages: homepage first, then service/contact/about pages
  const priorityKeywords = ['service', 'about', 'contact', 'pricing', 'menu', 'faq', 'team', 'attorney', 'lawyer'];
  const sorted = [...crawlResult.pages].sort((a, b) => {
    const aHigh = priorityKeywords.some(k => a.url.toLowerCase().includes(k));
    const bHigh = priorityKeywords.some(k => b.url.toLowerCase().includes(k));
    if (aHigh && !bHigh) return -1;
    if (!aHigh && bHigh) return 1;
    if (a.url === crawlResult.normalizedSourceUrl) return -1;
    if (b.url === crawlResult.normalizedSourceUrl) return 1;
    return 0;
  });

  // Limit total content
  const MAX_TOTAL_CHARS = 15000;
  let totalLength = 0;

  for (const page of sorted) {
    const headings = [...page.h1, ...page.h2, ...page.h3].filter(Boolean);
    const text = page.visibleText.slice(0, 2000); // Limit per page
    const header = `[${page.url}] ${page.title || '(no title)'}`;
    const headingStr = headings.length > 0 ? `\nHeadings: ${headings.join(' > ')}` : '';
    const signalStr = page.businessSignals.phoneNumbers.length > 0 || page.businessSignals.emails.length > 0
      ? `\nContact: ${page.businessSignals.phoneNumbers.join(', ')} ${page.businessSignals.emails.join(', ')}`
      : '';

    const pageContent = header + headingStr + signalStr + '\n\n' + text;
    pageTitles.push(page.title || page.url);
    pageTexts.push(pageContent);
    totalLength += pageContent.length;

    if (totalLength > MAX_TOTAL_CHARS) break;
  }

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