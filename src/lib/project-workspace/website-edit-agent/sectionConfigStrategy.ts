import { promises as fs } from 'fs';
import path from 'path';
import { getLLMClient } from '@/lib/llm/llmClient';
import {
  computeWorkspaceHashes,
  getChangedFilesFromHashes,
  isSafeWritePath,
} from '../workspaceEditShared';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { verifyEditApplied } from './verifyEditApplied';
import { isImagePlacementRequest } from './imagePlacementIntent';
import { formatConversationForPrompt } from './editAmbiguity';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from './types';

const SITE_CONFIG = 'src/lib/siteConfig.ts';
const PAGE_TSX = 'src/app/page.tsx';

type FileEdit = { path: string; content: string };
type LlmEditResponse = { files: FileEdit[]; summary?: string };

/**
 * Single-shot section updates via siteConfig.sections (GitLab Next sites).
 */
export async function runSectionConfigStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (options.mode !== 'gitlab') {
    return null;
  }

  if (
    (options.attachments ?? []).length === 0 &&
    isImagePlacementRequest(options.ownerMessage)
  ) {
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

  let pageSnippet = '';
  try {
    const pageContent = await readRel(PAGE_TSX);
    if (!pageContent) throw new Error('missing');
    if (pageContent.length <= 4000) {
      pageSnippet = pageContent;
    } else {
      pageSnippet = `${pageContent.slice(0, 4000)}\n/* … truncated … */`;
    }
  } catch {
    /* optional */
  }

  const lower = options.ownerMessage.toLowerCase();
  const historyBlock = formatConversationForPrompt(options.conversationHistory);
  const llm = getLLMClient();
  const result = await llm.generateJSON<LlmEditResponse>({
    system: `You are a website content editor. Update src/lib/siteConfig.ts to fulfill the owner's section request.

Rules:
- Homepage sections live in siteConfig.sections (array of { type, title, subtitle?, body?, items? }).
- FAQ items: item.title = question (with "?"), item.description = answer.
- Testimonial items: item.title = customer name, item.description = quote.
- If a section type already exists, UPDATE that section (especially its items array) — do not skip because content exists.
- If the section type is missing, append a new entry to sections.
- Do not invent phone numbers or street addresses.
- Do NOT add, move, or copy imageUrl or /uploads/ paths unless the owner attached new images in this request.
- Return the FULL updated siteConfig.ts file content.`,
    prompt: `${historyBlock}Owner request: ${options.ownerMessage}

${lower.includes('faq') ? 'Add or update an FAQ section with the requested number of Q&A pairs in siteConfig.sections.' : ''}
${lower.includes('testimonial') ? 'Add or update the testimonials section with the requested number of short quotes in siteConfig.sections. Replace items when updating an existing testimonials section.' : ''}

Current ${SITE_CONFIG}:
${siteConfigContent}

${pageSnippet ? `page.tsx renders siteConfig.sections (reference only):\n${pageSnippet}` : ''}

Return JSON: { "files": [{ "path": "${SITE_CONFIG}", "content": "..." }], "summary": "owner-facing note" }`,
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

    if (!parseSiteConfigSource(file.content)) {
      continue;
    }

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
  const afterFiles: Record<string, string> = {
    ...beforeFiles,
    [SITE_CONFIG]: afterSiteConfig ?? '',
  };

  const verification = verifyEditApplied(options.ownerMessage, beforeFiles, afterFiles);
  if (!verification.ok) {
    return null;
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
    strategy: 'section_config',
    tier: 'L2',
    summary: result.data.summary || 'Updated your website section.',
    ownerMessage: result.data.summary || 'Updated your website section.',
    changedFiles,
  };
}
