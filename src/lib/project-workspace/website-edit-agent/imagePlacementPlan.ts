import { getLLMClient } from '@/lib/llm/llmClient';
import type { WorkspaceAssetAttachment } from '../workspaceAssetTypes';
import {
  analyzeSiteStructureForImages,
  buildStructureBriefForPlanner,
  planImagePlacementFallback,
  type SiteStructureSnapshot,
} from './siteStructureAnalysis';

export type ImagePlacementAction = 'create_section' | 'update_section';

export interface ImagePlacementPlan {
  action: ImagePlacementAction;
  /** Section type to create or that hosts images (gallery, generic, about, …). */
  sectionType: string;
  /** Insert new section after this type (null = beginning of sections array). */
  insertAfterSectionType: string | null;
  targetSectionIndex: number | null;
  targetSectionTitle: string | null;
  title: string;
  body?: string;
  reasoning: string;
}

type LlmPlanResponse = {
  action: ImagePlacementAction;
  sectionType: string;
  insertAfterSectionType?: string | null;
  targetSectionIndex?: number | null;
  targetSectionTitle?: string | null;
  title: string;
  body?: string;
  reasoning: string;
};

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['create_section', 'update_section'] },
    sectionType: { type: 'string' },
    insertAfterSectionType: { type: ['string', 'null'] },
    targetSectionIndex: { type: ['number', 'null'] },
    targetSectionTitle: { type: ['string', 'null'] },
    title: { type: 'string' },
    body: { type: 'string' },
    reasoning: { type: 'string' },
  },
  required: ['action', 'sectionType', 'title', 'reasoning'],
};

function normalizePlan(raw: LlmPlanResponse, snapshot: SiteStructureSnapshot): ImagePlacementPlan {
  const action: ImagePlacementAction =
    raw.action === 'update_section' ? 'update_section' : 'create_section';

  let insertAfter =
    raw.insertAfterSectionType === null || raw.insertAfterSectionType === undefined
      ? null
      : String(raw.insertAfterSectionType).toLowerCase().replace(/^after:/, '');

  if (
    insertAfter &&
    !snapshot.sections.some((s) => s.type === insertAfter) &&
    action === 'create_section'
  ) {
    insertAfter = planImagePlacementFallback(snapshot, '').insertAfterSectionType;
  }

  return {
    action,
    sectionType: 'gallery',
    insertAfterSectionType: action === 'create_section' ? insertAfter : null,
    targetSectionIndex:
      typeof raw.targetSectionIndex === 'number' ? raw.targetSectionIndex : null,
    targetSectionTitle: raw.targetSectionTitle?.trim() || null,
    title: String(raw.title || 'Our work').slice(0, 120),
    body: raw.body?.trim(),
    reasoning: String(raw.reasoning || 'Planned from site structure.').slice(0, 500),
  };
}

/**
 * Read site context and decide where/how to place uploaded images (one LLM call + fallback).
 */
export async function planImagePlacement(input: {
  ownerMessage: string;
  attachments: WorkspaceAssetAttachment[];
  siteConfigContent: string;
  pageContent: string;
  pageSnippetMaxChars?: number;
}): Promise<{ plan: ImagePlacementPlan; snapshot: SiteStructureSnapshot; usedLlm: boolean }> {
  const snapshot = analyzeSiteStructureForImages(input.siteConfigContent, input.pageContent);
  const structureBrief = buildStructureBriefForPlanner(snapshot);
  const attachmentList = input.attachments
    .map((a, i) => `  ${i + 1}. ${a.publicUrl} (${a.originalName})`)
    .join('\n');

  const pageCap = input.pageSnippetMaxChars ?? 6000;
  const pageSnippet =
    input.pageContent.length <= pageCap
      ? input.pageContent
      : `${input.pageContent.slice(0, pageCap)}\n/* … page.tsx truncated … */`;

  const llm = getLLMClient();
  const result = await llm.generateJSON<LlmPlanResponse>({
    system: `You plan where to put owner-uploaded images on a small-business marketing site.

You receive:
- Current siteConfig.sections (ordered)
- Which section types page.tsx actually renders (switch cases)
- Owner message and image URLs

Output a single placement plan (JSON only).

Rules:
- Prefer UPDATE an existing section that already has imageUrl items if the owner says "these images", "add description", or similar follow-up.
- When the owner names a section (e.g. "introduction", "intro", "about"), set action to update_section with targetSectionTitle matching that section — do not create a duplicate gallery elsewhere.
- Prefer CREATE a dedicated "gallery" section when page has or can use gallery/generic rendering and images are new product/project photos.
- insertAfterSectionType must be a section type that EXISTS in siteConfig (e.g. services, about) — or null only to insert at the start of sections.
- Do NOT pick contact/faq as insert anchor unless owner asked.
- sectionType must ALWAYS be "gallery" for uploaded product images (never "services", "generic", or "about" — those layouts do not show imageUrl).
- Titles/body should match owner intent (professional, short).`,
    prompt: `Owner request: ${input.ownerMessage}

Uploaded images:
${attachmentList}

${structureBrief}

page.tsx (reference):
${pageSnippet}

Return JSON plan.`,
    schema: PLAN_SCHEMA,
  });

  if (result.ok && result.data?.title) {
    return {
      plan: normalizePlan(result.data, snapshot),
      snapshot,
      usedLlm: true,
    };
  }

  return {
    plan: planImagePlacementFallback(snapshot, input.ownerMessage),
    snapshot,
    usedLlm: false,
  };
}
