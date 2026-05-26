import { getLLMClient } from '@/lib/llm/llmClient';
import { getChangedFilesFromHashes, computeWorkspaceHashes } from '../workspaceEditShared';
import { applyPatchesToWorkspace } from './applyPatchesToWorkspace';
import { discoverContextFiles } from './discoverContextFiles';
import { buildImageAttachmentGuidance } from './enrichEditPrompt';
import {
  extractPresetObjectLiteral,
} from './preset/presetUtils';
import { PAGE_TSX, GLOBALS_CSS, SITE_CONFIG, readWorkspaceRel } from './strategyContext';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from './types';

const SCOPED_MAX_BYTES = 6000;
const EDIT_MAX_TOKENS = parseInt(process.env.WEBSITE_EDIT_MAX_TOKENS || '4096', 10);

type PatchResponse = {
  patches?: Array<{ path: string; find?: string; replace?: string; content?: string }>;
  files?: Array<{ path: string; content: string }>;
  summary?: string;
};

async function buildScopedContext(
  options: WebsiteEditAgentOptions
): Promise<Record<string, string>> {
  const lower = options.ownerMessage.toLowerCase();
  const payload: Record<string, string> = {};

  const page = await readWorkspaceRel(options, PAGE_TSX);
  if (page) {
    const preset = extractPresetObjectLiteral(page);
    if (preset && (lower.includes('color') || lower.includes('background'))) {
      payload[`${PAGE_TSX} (preset)`] = preset;
    } else if (page.length <= SCOPED_MAX_BYTES) {
      payload[PAGE_TSX] = page;
    } else {
      payload[PAGE_TSX] = `${page.slice(0, SCOPED_MAX_BYTES)}\n/* … truncated … */`;
    }
  }

  if (lower.includes('color') || lower.includes('background') || lower.includes('style')) {
    const css = await readWorkspaceRel(options, GLOBALS_CSS);
    if (css) {
      payload[GLOBALS_CSS] =
        css.length <= SCOPED_MAX_BYTES
          ? css
          : `${css.slice(0, SCOPED_MAX_BYTES)}\n/* … truncated … */`;
    }
  }

  if (
    lower.includes('headline') ||
    lower.includes('section') ||
    lower.includes('faq') ||
    lower.includes('contact')
  ) {
    const config = await readWorkspaceRel(options, SITE_CONFIG);
    if (config) {
      payload[SITE_CONFIG] =
        config.length <= SCOPED_MAX_BYTES
          ? config
          : `${config.slice(0, SCOPED_MAX_BYTES)}\n/* … truncated … */`;
    }
  }

  if (Object.keys(payload).length === 0) {
    const candidates = await discoverContextFiles(
      options.workspacePath,
      options.mode,
      options.ownerMessage
    );
    for (const rel of candidates.slice(0, 3)) {
      const content = await readWorkspaceRel(options, rel);
      if (content) {
        payload[rel] =
          content.length <= SCOPED_MAX_BYTES
            ? content
            : `${content.slice(0, SCOPED_MAX_BYTES)}\n/* … truncated … */`;
      }
    }
  }

  return payload;
}

/**
 * L2 single-shot: scoped context + patch JSON (falls back to full file writes).
 */
export async function runSingleShotStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  const filePayload = await buildScopedContext(options);
  if (Object.keys(filePayload).length === 0) return null;

  const lower = options.ownerMessage.toLowerCase();
  const imageGuidance = buildImageAttachmentGuidance(options.attachments ?? []);

  const llm = getLLMClient();
  const result = await llm.generateJSON<PatchResponse>({
    maxTokens: EDIT_MAX_TOKENS,
    temperature: 0,
    system: `You are a website code editor. Prefer small patches over full files.
Return JSON: { "patches": [{ "path", "find", "replace" } OR { "path", "content" }], "summary": "..." }
For preset/color edits patch src/app/page.tsx preset keys and globals.css gradients.
Do not invent contact info.`,
    prompt: `Owner request: ${options.ownerMessage}
${imageGuidance ? `\n${imageGuidance}\n` : ''}

Context (scoped):
${JSON.stringify(filePayload, null, 2)}

Return patches only when possible; use full "content" only if patching is unsafe.`,
    schema: {
      type: 'object',
      properties: {
        patches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              find: { type: 'string' },
              replace: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['path'],
          },
        },
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
    },
  });

  if (!result.ok) return null;

  let wroteAny = false;

  if (result.data?.patches?.length) {
    const written = await applyPatchesToWorkspace(options, result.data.patches);
    wroteAny = written.length > 0;
  }

  if (!wroteAny && result.data?.files?.length) {
    const written = await applyPatchesToWorkspace(
      options,
      result.data.files.map((f) => ({ path: f.path, content: f.content }))
    );
    wroteAny = written.length > 0;
  }

  if (!wroteAny) return null;

  const afterHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);
  const changedFiles = getChangedFilesFromHashes(beforeHashes, afterHashes);

  if (changedFiles.length === 0) return null;

  return {
    ok: true,
    strategy: 'single_shot',
    tier: 'L2',
    summary: result.data.summary || 'Updated your website.',
    ownerMessage: result.data.summary || 'Updated your website.',
    changedFiles,
  };
}
