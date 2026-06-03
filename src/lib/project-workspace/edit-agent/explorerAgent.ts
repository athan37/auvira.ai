import { getLLMClient } from '@/lib/project-workspace/planner/llmClient';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import {
  buildSectionSurfaceCatalog,
  type SectionSurface,
} from '@/lib/project-workspace/edit-context/sectionSurfaceCatalog';
import { extractReplacementValue, messageTokens } from '@/lib/project-workspace/edit-context/configTextEditUtils';
import { enumerateAllowlistedFields } from '@/lib/project-workspace/edit-context/enumerateAllowlistedFields';

export interface ExplorerAgentProposal {
  action: 'apply' | 'clarify' | 'search_more';
  fieldPath?: string;
  value?: string;
  confidence: number;
  candidates?: Array<{ fieldPath: string; humanLabel: string; rationale?: string }>;
  rationale?: string;
}

export interface ExplorerAgentInput {
  editContext: EditContext;
  candidates: SectionSurface[];
  preExtractedValue?: string;
}

const EXPLORER_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['apply', 'clarify', 'search_more'] },
    fieldPath: { type: 'string' },
    value: { type: 'string' },
    confidence: { type: 'number' },
    rationale: { type: 'string' },
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fieldPath: { type: 'string' },
          humanLabel: { type: 'string' },
          rationale: { type: 'string' },
        },
        required: ['fieldPath', 'humanLabel'],
      },
    },
  },
  required: ['action', 'confidence'],
};

function listSectionSurfaces(surfaces: SectionSurface[]): unknown {
  return surfaces.map((s) => ({
    surfaceId: s.surfaceId,
    humanLabel: s.humanLabel,
    fieldPath: s.fieldPath,
    visibleText: s.visibleText,
    editFamily: s.editFamily,
    source: s.source,
  }));
}

function matchUserPhrase(message: string, surfaces: SectionSurface[]): unknown {
  const tokens = messageTokens(message);
  return surfaces.map((s) => {
    let score = 0;
    const label = s.humanLabel.toLowerCase();
    const visible = (s.visibleText ?? '').toLowerCase();
    for (const t of tokens) {
      if (label.includes(t)) score += 2;
      if (visible.includes(t)) score += 3;
    }
    return { fieldPath: s.fieldPath, humanLabel: s.humanLabel, score };
  }).sort((a, b) => (b as { score: number }).score - (a as { score: number }).score);
}

function readConfigField(siteConfigContent: string, fieldPath: string): unknown {
  const entry = enumerateAllowlistedFields(siteConfigContent).find(
    (e) => e.fieldPath === fieldPath
  );
  return { fieldPath, value: entry?.value ?? null };
}

/**
 * LLM explorer (1 round): proposes apply/clarify using read-only tool results.
 */
export async function runExplorerAgent(
  input: ExplorerAgentInput
): Promise<ExplorerAgentProposal | null> {
  const { editContext, candidates } = input;
  const sectionIndex =
    editContext.selectedTarget?.sectionIndex ?? editContext.target.sectionIndex;
  if (sectionIndex == null) return null;

  const siteConfigContent = editContext.siteModel.siteConfigContent ?? '';
  const surfaces =
    candidates.length > 0
      ? candidates
      : buildSectionSurfaceCatalog(siteConfigContent, sectionIndex, {
          selectedTarget: editContext.selectedTarget,
        });

  const message = editContext.effectiveMessage;
  const value = input.preExtractedValue ?? extractReplacementValue(message) ?? undefined;

  const toolResults = {
    list_section_surfaces: listSectionSurfaces(surfaces),
    match_user_phrase: matchUserPhrase(message, surfaces),
    read_config_field: surfaces.slice(0, 4).map((s) =>
      readConfigField(siteConfigContent, s.fieldPath)
    ),
  };

  const llm = getLLMClient();
  const system = `You are a read-only explorer for pinned website section edits.
Given tool results, choose which allowlisted fieldPath matches the owner's request.
Return JSON only. Use action "apply" only when confident; "clarify" when ambiguous; "search_more" only if truly insufficient (rare).
Do not invent field paths — pick from list_section_surfaces.`;

  const prompt = `Owner message: ${message}
Pinned section index: ${sectionIndex}
Section title: ${editContext.target.title ?? 'unknown'}
Extracted replacement value (if copy): ${value ?? '(none)'}

Tool results:
${JSON.stringify(toolResults, null, 2)}

Respond with action, confidence 0-1, fieldPath when applying, and optional candidates for clarify.`;

  const result = await llm.generateJSON<ExplorerAgentProposal>({
    system,
    prompt,
    schema: EXPLORER_SCHEMA,
    maxTokens: 1024,
    temperature: 0,
  });

  if (!result.ok || !result.data) return null;
  const data = result.data;
  if (typeof data.confidence !== 'number') data.confidence = 0.5;
  if (value && data.action === 'apply' && !data.value) data.value = value;
  return data;
}
