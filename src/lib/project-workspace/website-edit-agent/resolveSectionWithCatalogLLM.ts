import { getLLMClient } from '@/lib/llm/llmClient';
import { formatSectionCatalogForPrompt, type SiteSectionCatalog } from './siteSectionCatalog';

export interface CatalogLLMMatch {
  sectionIndex: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

const MAX_SECTIONS_FOR_LLM = 15;

function isSectionTargetLlmEnabled(): boolean {
  return process.env.SECTION_TARGET_LLM === '1';
}

/**
 * Optional LLM fallback to pick a section index from the catalog when deterministic matching fails.
 * Gated by SECTION_TARGET_LLM=1 and only runs for small sites (≤15 sections).
 */
export async function resolveSectionWithCatalogLLM(
  message: string,
  catalog: SiteSectionCatalog
): Promise<CatalogLLMMatch | null> {
  if (!isSectionTargetLlmEnabled()) {
    return null;
  }
  if (catalog.sections.length === 0 || catalog.sections.length > MAX_SECTIONS_FOR_LLM) {
    return null;
  }

  const llm = getLLMClient();
  const catalogBlock = formatSectionCatalogForPrompt(catalog);

  const prompt = `You pick which homepage section the owner wants to edit.

OWNER MESSAGE:
"${message.trim()}"

${catalogBlock}

Reply with JSON only:
{"sectionIndex": <number from [index] in catalog>, "confidence": "high"|"medium"|"low", "reason": "<short>"}

Rules:
- sectionIndex MUST be one of the [index] values listed above.
- If the message does not clearly target one section, use confidence "low" and pick the best guess anyway.
- Do not invent sections.`;

  try {
    const result = await llm.generateJSON<CatalogLLMMatch>({
      prompt,
      maxTokens: 256,
    });
    const parsed = result.data;
    if (parsed == null || typeof parsed.sectionIndex !== 'number') {
      return null;
    }
    const exists = catalog.sections.some((s) => s.index === parsed.sectionIndex);
    if (!exists) {
      return null;
    }
    return {
      sectionIndex: parsed.sectionIndex,
      confidence: parsed.confidence ?? 'medium',
      reason: parsed.reason ?? 'LLM catalog picker',
    };
  } catch {
    return null;
  }
}

export { isSectionTargetLlmEnabled };
