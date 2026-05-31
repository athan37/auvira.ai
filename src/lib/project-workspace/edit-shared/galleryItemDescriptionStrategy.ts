import { promises as fs } from 'fs';
import path from 'path';
import { getLLMClient } from '@/lib/llm/llmClient';
import {
  computeWorkspaceHashes,
  getChangedFilesFromHashes,
  isSafeWritePath,
} from '../workspaceEditShared';
import {
  applyPlaceholderGalleryDescriptions,
  resolveTargetGalleryForCaptions,
} from './imageEditIntent';
import { verifyEditApplied } from './verifyEditApplied';
import {
  analyzeSiteStructureForImages,
  buildStructureBriefForPlanner,
} from './siteStructureAnalysis';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from './types';

const SITE_CONFIG = 'src/lib/siteConfig.ts';

type FileEdit = { path: string; content: string };
type LlmEditResponse = { files: FileEdit[]; summary?: string };

/** Follow-up like "add description for these/that image(s)" (often no new attachments). */
export function isGalleryDescriptionRequest(message: string): boolean {
  const lower = message.toLowerCase();
  const hasCaptionIntent =
    /\b(description|descriptions|caption|captions|blurb|label|labels|text under|underneath|under it)\b/.test(
      lower
    ) ||
    /\bdesc\b/.test(lower) ||
    /\b(finish|complete)\s+(the\s+)?rest\b/.test(lower);
  const hasImageReference =
    /\b(image|images|photo|photos|picture|pictures|pics|pic|gallery|these|those|them|that|the|it)\b/.test(
      lower
    ) ||
    /\bjust (added|uploaded|created)\b/.test(lower) ||
    /\b(you just|just now)\b/.test(lower) ||
    /\bsection you (just )?created\b/.test(lower) ||
    /\bstill missing\b/.test(lower);
  return hasCaptionIntent && hasImageReference;
}

function buildTargetGalleryBlock(
  target: NonNullable<ReturnType<typeof resolveTargetGalleryForCaptions>>
): string {
  return (
    `TARGET GALLERY (update ONLY this section):\n` +
    `  sectionIndex: ${target.sectionIndex}\n` +
    `  title: "${target.title}"\n` +
    `  imageUrl items: ${target.imageCount}\n` +
    `  imageUrls: ${target.imageUrls.join(', ')}\n`
  );
}

async function generateCaptionEdits(
  options: WebsiteEditAgentOptions,
  siteConfigContent: string,
  structureBrief: string,
  targetBlock: string,
  strictRetry: boolean
): Promise<{ ok: boolean; data?: LlmEditResponse }> {
  const llm = getLLMClient();
  const retryNote = strictRetry
    ? '\nIMPORTANT: Your previous attempt did not add description fields. You MUST add description to every item with imageUrl in the TARGET GALLERY section only.'
    : '';

  const result = await llm.generateJSON<LlmEditResponse>({
    system: `You edit src/lib/siteConfig.ts for a business website.

The owner wants descriptions/captions for product images already in the gallery section.

Rules:
- Update ONLY the TARGET GALLERY section identified below.
- For each image item in that section, set or update "description" with 1–2 sentences (product/doc context). Keep "title" and "imageUrl" unchanged.
- If the owner gives specific wording, use it; otherwise write concise professional placeholder captions for every image item (never leave items without description).
- Do not remove sections or image URLs. Do not edit other sections.
- Return the FULL updated siteConfig.ts file.${retryNote}`,
    prompt: `Owner request: ${options.ownerMessage}

${targetBlock}

${structureBrief}

Current ${SITE_CONFIG}:
${siteConfigContent}

Return JSON: { "files": [{ "path": "${SITE_CONFIG}", "content": "..." }], "summary": "short owner-facing note" }`,
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['path', 'content'],
          },
        },
        summary: { type: 'string' },
      },
      required: ['files'],
    },
  });

  if (!result.ok || !result.data?.files?.length) {
    return { ok: false };
  }
  return { ok: true, data: result.data };
}

async function writeSiteConfigFromLlm(
  options: WebsiteEditAgentOptions,
  files: FileEdit[]
): Promise<boolean> {
  let wrote = false;
  for (const file of files) {
    const normalized = file.path.replace(/^\/+/, '');
    if (normalized !== SITE_CONFIG || !isSafeWritePath(normalized)) continue;

    if (options.gateway) {
      await options.gateway.writeFile(normalized, file.content);
    } else {
      await fs.writeFile(path.join(options.workspacePath, normalized), file.content, 'utf-8');
    }
    wrote = true;
  }
  return wrote;
}

/**
 * Single-shot update of item.description on the gallery section (items with imageUrl).
 */
export async function runGalleryItemDescriptionStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (options.mode !== 'gitlab' || !isGalleryDescriptionRequest(options.ownerMessage)) {
    return null;
  }

  async function readRel(rel: string): Promise<string | null> {
    try {
      return options.gateway
        ? await options.gateway.readFile(rel)
        : await fs.readFile(path.join(options.workspacePath, rel), 'utf-8');
    } catch {
      return null;
    }
  }

  const siteConfigContent = await readRel(SITE_CONFIG);
  if (!siteConfigContent) {
    return null;
  }

  if (!/imageUrl/.test(siteConfigContent) || !/\/uploads\//.test(siteConfigContent)) {
    return {
      ok: false,
      strategy: 'gallery_captions',
      error: 'No image gallery section found in siteConfig (items with imageUrl).',
      ownerMessage:
        'I could not find a product image section to add descriptions to. Try uploading images and asking for a section first.',
    };
  }

  const pageContent = (await readRel('src/app/page.tsx')) ?? '';
  const snapshot = analyzeSiteStructureForImages(siteConfigContent, pageContent);
  const structureBrief = buildStructureBriefForPlanner(snapshot);
  const targetGallery = resolveTargetGalleryForCaptions(
    siteConfigContent,
    options.conversationHistory,
    options.lastGalleryEdit,
    options.ownerMessage,
    options.editFocusStack
  );

  if (!targetGallery) {
    return {
      ok: false,
      strategy: 'gallery_captions',
      error: 'No target gallery section resolved',
      ownerMessage:
        'I could not find a product image section to add descriptions to. Try uploading images and asking for a section first.',
    };
  }

  const targetBlock = buildTargetGalleryBlock(targetGallery);
  const beforeFiles: Record<string, string> = { [SITE_CONFIG]: siteConfigContent };
  const descriptionField = /"description"\s*:|(?<![a-zA-Z_])description\s*:/;
  const hadDescriptions = descriptionField.test(siteConfigContent);

  let afterContent = siteConfigContent;
  let summaryFromLlm: string | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    const generated = await generateCaptionEdits(
      options,
      afterContent,
      structureBrief,
      targetBlock,
      attempt > 0
    );
    if (!generated.ok || !generated.data?.files?.length) {
      continue;
    }

    await writeSiteConfigFromLlm(options, generated.data.files);
    afterContent = (await readRel(SITE_CONFIG)) ?? afterContent;
    summaryFromLlm = generated.data.summary;

    if (descriptionField.test(afterContent) && afterContent !== siteConfigContent) {
      break;
    }
  }

  if (!descriptionField.test(afterContent) || afterContent === siteConfigContent) {
    const placeholder = applyPlaceholderGalleryDescriptions(afterContent, targetGallery);
    if (placeholder) {
      if (options.gateway) {
        await options.gateway.writeFile(SITE_CONFIG, placeholder);
      } else {
        await fs.writeFile(path.join(options.workspacePath, SITE_CONFIG), placeholder, 'utf-8');
      }
      afterContent = (await readRel(SITE_CONFIG)) ?? placeholder;
    }
  }

  const hasDescriptions = descriptionField.test(afterContent);
  if (!hasDescriptions || afterContent === siteConfigContent) {
    return {
      ok: false,
      strategy: 'gallery_captions',
      error: 'siteConfig unchanged or no item descriptions added',
      ownerMessage:
        'I could not add image descriptions. Try: "Add a short description under each product image in the gallery section."',
    };
  }

  const afterFiles: Record<string, string> = {
    ...beforeFiles,
    [SITE_CONFIG]: afterContent,
  };

  const verification = verifyEditApplied(options.ownerMessage, beforeFiles, afterFiles);
  if (!verification.ok) {
    return {
      ok: false,
      strategy: 'gallery_captions',
      error: verification.reason,
      ownerMessage: "I couldn't safely apply those image descriptions. Please try rephrasing.",
    };
  }

  const afterHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);
  const changedFiles = getChangedFilesFromHashes(beforeHashes, afterHashes);
  if (changedFiles.length === 0) {
    return null;
  }

  const ownerMessage =
    summaryFromLlm ||
    (hadDescriptions
      ? 'Updated descriptions for your product images.'
      : 'Added descriptions under your product images.');

  return {
    ok: true,
    strategy: 'gallery_captions',
    summary: ownerMessage,
    ownerMessage,
    changedFiles,
    lastGalleryEdit: {
      sectionIndex: targetGallery.sectionIndex,
      title: targetGallery.title,
      imageUrls: targetGallery.imageUrls,
      imageCount: targetGallery.imageCount,
    },
    editMeta: {
      lastGalleryEdit: {
        sectionIndex: targetGallery.sectionIndex,
        title: targetGallery.title,
        imageUrls: targetGallery.imageUrls,
        imageCount: targetGallery.imageCount,
      },
    },
  };
}
