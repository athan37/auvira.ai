import { promises as fs } from 'fs';
import path from 'path';
import { getLLMClient } from '@/lib/llm/llmClient';
import {
  computeWorkspaceHashes,
  getChangedFilesFromHashes,
  isSafeWritePath,
} from '../workspaceEditShared';
import { buildImageAttachmentGuidance } from './enrichEditPrompt';
import { patchGenericSectionForImages } from './patchGenericSectionImages';
import { verifyEditApplied } from './verifyEditApplied';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from './types';

const SITE_CONFIG = 'src/lib/siteConfig.ts';
const PAGE_TSX = 'src/app/page.tsx';

type FileEdit = { path: string; content: string };
type LlmEditResponse = { files: FileEdit[]; summary?: string };

function inferSectionTitle(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('documentation') || lower.includes('document')) {
    return 'Product documentation';
  }
  if (lower.includes('product')) {
    return 'Our products';
  }
  if (lower.includes('gallery')) {
    return 'Gallery';
  }
  return 'Featured images';
}

/**
 * Section + uploaded images: update siteConfig only (small write), then patch page.tsx for image grid.
 * Avoids single-shot full page rewrites that can trigger Vercel Sandbox Files API 400 errors.
 */
export async function runImageGallerySectionStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  const attachments = options.attachments ?? [];
  if (attachments.length === 0 || options.mode !== 'gitlab') {
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

  async function writeRel(rel: string, content: string): Promise<void> {
    if (options.gateway) {
      await options.gateway.writeFile(rel, content);
    } else {
      const dest = path.join(options.workspacePath, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, content, 'utf-8');
    }
  }

  const siteConfigContent = await readRel(SITE_CONFIG);
  if (!siteConfigContent) {
    return null;
  }

  const imageGuidance = buildImageAttachmentGuidance(attachments);
  const sectionTitle = inferSectionTitle(options.ownerMessage);
  const llm = getLLMClient();

  const result = await llm.generateJSON<LlmEditResponse>({
    system: `You are a website content editor. Update ONLY src/lib/siteConfig.ts for a new image gallery / documentation section.

Rules:
- Append (or update) a section in siteConfig.sections with type "generic".
- Each uploaded image becomes one item: { title: short label from filename, description?: optional caption, imageUrl: exact public URL from attachments }.
- Use the owner's wording for section title and body when clear; otherwise title: "${sectionTitle}".
- Do NOT remove existing sections unless the owner asked to replace them.
- Return the FULL updated siteConfig.ts file.
- Do not invent phone numbers or addresses.`,
    prompt: `Owner request: ${options.ownerMessage}

${imageGuidance}

Suggested section title if not specified: "${sectionTitle}"

Current ${SITE_CONFIG}:
${siteConfigContent.length > 16_000 ? `${siteConfigContent.slice(0, 16_000)}\n/* truncated */` : siteConfigContent}

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
    await writeRel(normalized, file.content);
    wroteSiteConfig = true;
  }

  if (!wroteSiteConfig) {
    return null;
  }

  const pageBefore = await readRel(PAGE_TSX);
  if (pageBefore) {
    beforeFiles[PAGE_TSX] = pageBefore;
    const { content: patchedPage, patched } = patchGenericSectionForImages(pageBefore);
    if (patched) {
      await writeRel(PAGE_TSX, patchedPage);
    }
  }

  const afterSiteConfig = (await readRel(SITE_CONFIG)) ?? '';
  const afterPage = (await readRel(PAGE_TSX)) ?? '';
  const afterFiles: Record<string, string> = {
    [SITE_CONFIG]: afterSiteConfig,
    ...(pageBefore ? { [PAGE_TSX]: afterPage } : {}),
  };

  const verification = verifyEditApplied(options.ownerMessage, beforeFiles, afterFiles);
  if (!verification.ok) {
    return {
      ok: false,
      strategy: 'image_gallery',
      error: verification.reason,
      ownerMessage: "I couldn't safely apply that section. Please try rephrasing your request.",
    };
  }

  const afterHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);
  const changedFiles = getChangedFilesFromHashes(beforeHashes, afterHashes);
  if (changedFiles.length === 0) {
    return null;
  }

  return {
    ok: true,
    strategy: 'image_gallery',
    summary: result.data.summary || 'Added your product images in a new section.',
    ownerMessage: result.data.summary || 'Added your product images in a new section.',
    changedFiles,
  };
}
