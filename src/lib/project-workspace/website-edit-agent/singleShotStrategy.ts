import { promises as fs } from 'fs';
import path from 'path';
import { getLLMClient } from '@/lib/llm/llmClient';
import { getChangedFilesFromHashes, computeWorkspaceHashes, isSafeWritePath } from '../workspaceEditShared';
import { discoverContextFiles, PRIORITY_CONTEXT_FILES } from './discoverContextFiles';
import { loadContextFileContents } from './discoverContextFiles';
import { buildImageAttachmentGuidance } from './enrichEditPrompt';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult, WorkspaceMode } from './types';

const MAX_FILE_BYTES = 12_000;

type FileEdit = { path: string; content: string };
type LlmEditResponse = { files: FileEdit[]; summary?: string };

async function discoverCandidateFiles(
  workspacePath: string,
  mode: WorkspaceMode,
  ownerMessage: string
): Promise<string[]> {
  return discoverContextFiles(workspacePath, mode, ownerMessage);
}

/**
 * Enhanced single-shot edit: discover files, one LLM call, write results.
 */
export async function runSingleShotStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  const isSectionEdit = /\b(section|add a|add new|make a)\b/.test(
    options.ownerMessage.toLowerCase()
  );
  const hasImages = (options.attachments?.length ?? 0) > 0;

  let candidates = await discoverCandidateFiles(
    options.workspacePath,
    options.mode,
    options.ownerMessage
  );
  if (isSectionEdit || hasImages) {
    candidates = [...PRIORITY_CONTEXT_FILES];
  }

  const filePayload: Record<string, string> = {};
  if (options.gateway) {
    for (const rel of candidates) {
      try {
        const content = await options.gateway.readFile(rel);
        filePayload[rel] =
          content.length <= MAX_FILE_BYTES
            ? content
            : `${content.slice(0, MAX_FILE_BYTES)}\n/* … truncated … */`;
      } catch {
        /* missing */
      }
    }
  } else {
    Object.assign(
      filePayload,
      await loadContextFileContents(options.workspacePath, candidates)
    );
  }

  if (Object.keys(filePayload).length === 0) {
    return null;
  }

  const lower = options.ownerMessage.toLowerCase();
  const isBackgroundEdit =
    lower.includes('background') ||
    lower.includes('color') ||
    /\b(green|red|blue|yellow|orange|purple|pink)\b/.test(lower);
  const imageGuidance = buildImageAttachmentGuidance(options.attachments ?? []);

  const llm = getLLMClient();
  const result = await llm.generateJSON<LlmEditResponse>({
    system: `You are a website code editor. Apply the owner's request by returning updated file contents.
Return JSON only. Include every file you change with full new content.
Do not invent contact info.
For background/color requests: update src/app/page.tsx — set preset.pageBg, preset.heroBg, preset.surfaceBg and hero/main className to Tailwind bg-{color}-600 (e.g. bg-blue-600). Remove old bg-red-* / other color classes. Optionally update globals.css; page.tsx is required for the preview.
For headline/copy with a specific new phrase: update src/lib/siteConfig.ts hero.headline and any matching text in src/app/page.tsx.
For new section + uploaded image: (1) save uses /uploads/... paths from attachments; (2) append to siteConfig.sections with type "generic", title/body about the product; (3) add or update a GenericSection in page.tsx that shows the image with <img src="/uploads/..." /> and wire SectionRenderer case "generic" to render it (generic sections currently return null).`,
    prompt: `Owner request: ${options.ownerMessage}
${isBackgroundEdit ? '\nThis is a background/color edit — update globals.css and page.tsx preset colors together when present.' : ''}
${isSectionEdit ? '\nThis is a new section request — update siteConfig.sections AND page.tsx so the section is visible (including generic type).' : ''}
${imageGuidance ? `\n${imageGuidance}\n` : ''}

Current files:
${JSON.stringify(filePayload, null, 2)}

Return: { "files": [{ "path": "relative/path", "content": "..." }], "summary": "short owner-facing note" }`,
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

  let wroteAny = false;
  for (const file of result.data.files) {
    const normalized = file.path.replace(/^\/+/, '');
    if (!isSafeWritePath(normalized)) continue;

    if (options.gateway) {
      await options.gateway.writeFile(normalized, file.content);
    } else {
      const dest = path.join(options.workspacePath, normalized);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, file.content, 'utf-8');
    }
    wroteAny = true;
  }

  if (!wroteAny) {
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
    strategy: 'single_shot',
    summary: result.data.summary || 'Updated your website.',
    ownerMessage: result.data.summary || 'Updated your website.',
    changedFiles,
  };
}
