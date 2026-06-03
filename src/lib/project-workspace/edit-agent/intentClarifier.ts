import { getLLMClient } from '@/lib/project-workspace/planner/llmClient';
import type { SectionSurface } from '@/lib/project-workspace/edit-context/sectionSurfaceCatalog';

export const INTENT_CLARIFIER_SILENT_THRESHOLD = 0.85;

export interface IntentClarifierResult {
  fieldPath: string;
  humanLabel: string;
  confidence: number;
  silentPick: boolean;
}

const CLARIFIER_SCHEMA = {
  type: 'object',
  properties: {
    fieldPath: { type: 'string' },
    humanLabel: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['fieldPath', 'confidence'],
};

/**
 * Lightweight LLM pick among explorer candidates (silent when confidence ≥ threshold).
 */
export async function runIntentClarifier(input: {
  message: string;
  sectionTitle?: string;
  candidates: SectionSurface[];
  explorerRationale?: string;
}): Promise<IntentClarifierResult | null> {
  const { message, candidates } = input;
  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    return {
      fieldPath: candidates[0]!.fieldPath,
      humanLabel: candidates[0]!.humanLabel,
      confidence: 0.9,
      silentPick: true,
    };
  }

  const llm = getLLMClient();
  const system = `Pick exactly one surface (fieldPath) the owner wants to edit.
Return confidence 0-1. Only use fieldPaths from the candidate list.`;

  const candidateLines = candidates
    .map((c) => `- ${c.humanLabel} → ${c.fieldPath}${c.visibleText ? ` (shows: "${c.visibleText}")` : ''}`)
    .join('\n');

  const prompt = `Section: ${input.sectionTitle ?? 'pinned section'}
Owner message: ${message}
${input.explorerRationale ? `Explorer note: ${input.explorerRationale}\n` : ''}
Candidates:
${candidateLines}

Return fieldPath, humanLabel, confidence.`;

  const result = await llm.generateJSON<{
    fieldPath?: string;
    humanLabel?: string;
    confidence?: number;
  }>({
    system,
    prompt,
    schema: CLARIFIER_SCHEMA,
    maxTokens: 512,
    temperature: 0,
  });

  if (!result.ok || !result.data?.fieldPath) return null;

  const matched =
    candidates.find((c) => c.fieldPath === result.data!.fieldPath) ?? candidates[0]!;
  const confidence =
    typeof result.data.confidence === 'number' ? result.data.confidence : 0.5;

  return {
    fieldPath: matched.fieldPath,
    humanLabel: result.data.humanLabel ?? matched.humanLabel,
    confidence,
    silentPick: confidence >= INTENT_CLARIFIER_SILENT_THRESHOLD,
  };
}
