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
- Match section **type** and **title** to owner intent (e.g. portfolio/photos/work samples → type="gallery"; customer quotes/growth stories → type="testimonials").
- When the owner says "section titled X", match only when a catalog title equals X or clearly contains X as a multi-word phrase — never pick a section because a single common word (e.g. "business") appears inside a longer title.
- If the message does not clearly target one section, use confidence "low".
- Do not invent sections.`;

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await llm.generateJSON<CatalogLLMMatch>({
        prompt,
        maxTokens: 256,
      });
      const parsed = result.data;
      if (parsed == null || typeof parsed.sectionIndex !== 'number') {
        continue;
      }
      const exists = catalog.sections.some((s) => s.index === parsed.sectionIndex);
      if (!exists) {
        continue;
      }
      return {
        sectionIndex: parsed.sectionIndex,
        confidence: parsed.confidence ?? 'medium',
        reason: parsed.reason ?? 'LLM catalog picker',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export { isSectionTargetLlmEnabled };
