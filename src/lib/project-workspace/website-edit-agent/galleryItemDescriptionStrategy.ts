import { promises as fs } from 'fs';
import path from 'path';
import { getLLMClient } from '@/lib/llm/llmClient';
import {
  computeWorkspaceHashes,
  getChangedFilesFromHashes,
  isSafeWritePath,
} from '../workspaceEditShared';
import { verifyEditApplied } from './verifyEditApplied';
import {
  analyzeSiteStructureForImages,
  buildStructureBriefForPlanner,
} from './siteStructureAnalysis';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from './types';

const SITE_CONFIG = 'src/lib/siteConfig.ts';

type FileEdit = { path: string; content: string };
type LlmEditResponse = { files: FileEdit[]; summary?: string };

/** Follow-up like "add description for these images" (often no new attachments). */
export function isGalleryDescriptionRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /\b(description|descriptions|caption|captions)\b/.test(lower) &&
    /\b(image|images|photo|photos|picture|pictures|gallery|these|those|them)\b/.test(lower)
  );
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

  const pageContent = (await readRel('src/app/page.tsx')) ?? '';
  const snapshot = analyzeSiteStructureForImages(siteConfigContent, pageContent);
  const structureBrief = buildStructureBriefForPlanner(snapshot);

  if (!/imageUrl/.test(siteConfigContent) || !/\/uploads\//.test(siteConfigContent)) {
    return {
      ok: false,
      strategy: 'single_shot',
      error: 'No image gallery section found in siteConfig (items with imageUrl).',
      ownerMessage:
        'I could not find a product image section to add descriptions to. Try uploading images and asking for a section first.',
    };
  }

  const llm = getLLMClient();
  const result = await llm.generateJSON<LlmEditResponse>({
    system: `You edit src/lib/siteConfig.ts for a business website.

The owner wants descriptions/captions for product images already in the gallery section.

Rules:
- Find the section in siteConfig.sections whose items use "imageUrl" (paths like /uploads/...).
- For each image item, set or update "description" with 1–2 sentences (product/doc context). Keep "title" and "imageUrl" unchanged.
- If the owner gives specific wording, use it; otherwise write concise professional captions.
- Do not remove sections or image URLs.
- Return the FULL updated siteConfig.ts file.`,
    prompt: `Owner request: ${options.ownerMessage}

${structureBrief}

Update ONLY the section(s) that contain imageUrl items (/uploads/...). Do not move sections or change placement.

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
    return null;
  }

  const beforeFiles: Record<string, string> = { [SITE_CONFIG]: siteConfigContent };
  let wroteSiteConfig = false;

  for (const file of result.data.files) {
    const normalized = file.path.replace(/^\/+/, '');
    if (normalized !== SITE_CONFIG || !isSafeWritePath(normalized)) continue;

    if (options.gateway) {
      await options.gateway.writeFile(normalized, file.content);
    } else {
      await fs.writeFile(path.join(options.workspacePath, normalized), file.content, 'utf-8');
    }
    wroteSiteConfig = true;
  }

  if (!wroteSiteConfig) {
    return null;
  }

  const afterSiteConfig = await readRel(SITE_CONFIG);
  const afterContent = afterSiteConfig ?? '';
  const hadDescriptions = /"description"\s*:/.test(siteConfigContent);
  const hasDescriptions = /"description"\s*:/.test(afterContent);

  if (!hasDescriptions || afterContent === siteConfigContent) {
    return {
      ok: false,
      strategy: 'single_shot',
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
      strategy: 'single_shot',
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
    result.data.summary ||
    (hadDescriptions
      ? 'Updated descriptions for your product images.'
      : 'Added descriptions under your product images.');

  return {
    ok: true,
    strategy: 'single_shot',
    summary: ownerMessage,
    ownerMessage,
    changedFiles,
  };
}
