import { getLLMClient } from '@/lib/llm/llmClient';
import { buildFaqSectionSkeleton } from '../sectionTemplates';
import {
  buildStrategyResult,
  readWorkspaceRel,
  SITE_CONFIG,
  writeWorkspaceRel,
} from '../strategyContext';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

function parseFaqCount(message: string): number {
  const m = message.match(/(\d+)\s*(?:question|q&a|faq|items?)/i) || message.match(/faq.*?(\d+)/i);
  if (m?.[1]) return parseInt(m[1], 10);
  return 3;
}

type FaqItemsResponse = { items: Array<{ title: string; description: string }> };

/**
 * L1: append FAQ section skeleton to siteConfig; optional LLM fills Q&A items.
 */
export async function runSectionFaqTemplateStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (options.mode !== 'gitlab' || !/\bfaq\b/i.test(options.ownerMessage)) {
    return null;
  }

  const content = await readWorkspaceRel(options, SITE_CONFIG);
  if (!content) return null;

  const count = parseFaqCount(options.ownerMessage);
  let skeleton = buildFaqSectionSkeleton(count);

  if (/\badd\b/i.test(options.ownerMessage) && hasExplicitContentRequest(options.ownerMessage)) {
    const llm = getLLMClient();
    const result = await llm.generateJSON<FaqItemsResponse>({
      system:
        'Return JSON only. Generate FAQ question/answer pairs for a small business website.',
      prompt: `Owner request: ${options.ownerMessage}\nReturn { "items": [{ "title": "question with ?", "description": "answer" }] } with ${count} items.`,
      schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['title', 'description'],
            },
          },
        },
        required: ['items'],
      },
    });

    if (result.ok && result.data?.items?.length) {
      const itemsStr = result.data.items
        .map(
          (it) =>
            `      { title: '${it.title.replace(/'/g, "\\'")}', description: '${it.description.replace(/'/g, "\\'")}' }`
        )
        .join(',\n');
      skeleton = `{
    type: 'faq',
    title: 'Frequently Asked Questions',
    items: [
${itemsStr}
    ]
  }`;
    }
  }

  let updated: string;
  if (/type\s*:\s*['"]faq['"]/i.test(content)) {
    const itemsInner = skeleton.match(/items\s*:\s*\[([\s\S]*?)\]\s*\}/)?.[1];
    if (!itemsInner) return null;
    updated = content.replace(
      /(type\s*:\s*['"]faq['"][\s\S]*?items\s*:\s*\[)[\s\S]*?(\])/i,
      `$1\n${itemsInner}\n    $2`
    );
    if (updated === content) return null;
  } else if (/sections\s*:\s*\[/.test(content)) {
    updated = content.replace(/sections\s*:\s*\[/, `sections: [\n    ${skeleton},`);
  } else {
    return null;
  }

  await writeWorkspaceRel(options, SITE_CONFIG, updated);

  return buildStrategyResult(
    options,
    beforeHashes,
    'section_faq_template',
    'L1',
    `Added FAQ section with ${count} question(s).`,
    { confidence: 'medium' }
  );
}

function hasExplicitContentRequest(message: string): boolean {
  return /\d+/.test(message) || /question|q&a/i.test(message);
}
