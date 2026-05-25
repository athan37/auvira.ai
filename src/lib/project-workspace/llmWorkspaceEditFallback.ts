import { promises as fs } from 'fs';
import path from 'path';
import { getLLMClient } from '@/lib/llm/llmClient';

const EDIT_CANDIDATES = [
  'src/app/globals.css',
  'src/app/page.tsx',
  'src/app/layout.tsx',
  'src/lib/siteConfig.ts',
];

type FileEdit = { path: string; content: string };

type LlmEditResponse = { files: FileEdit[]; summary?: string };

/**
 * Direct LLM file edit when Cline CLI cannot apply tool calls (e.g. proxy lacks Responses API).
 */
export async function tryLlmWorkspaceEdit(
  workspacePath: string,
  ownerMessage: string
): Promise<{ ok: boolean; summary?: string; error?: string }> {
  const filePayload: Record<string, string> = {};

  for (const rel of EDIT_CANDIDATES) {
    try {
      const content = await fs.readFile(path.join(workspacePath, rel), 'utf-8');
      if (content.length < 80_000) {
        filePayload[rel] = content;
      }
    } catch {
      /* missing file */
    }
  }

  if (Object.keys(filePayload).length === 0) {
    return { ok: false, error: 'No editable source files found in workspace.' };
  }

  const lower = ownerMessage.toLowerCase();
  const isBackgroundEdit =
    lower.includes('background') ||
    lower.includes('color') ||
    /\b(green|red|blue|yellow|orange|purple|pink)\b/.test(lower);

  const llm = getLLMClient();
  const result = await llm.generateJSON<LlmEditResponse>({
    system: `You are a website code editor. Apply the owner's request by returning updated file contents.
Return JSON only. Include every file you change with full new content.
Do not invent contact info.
For background/color requests: update BOTH src/app/globals.css (body background) AND src/app/page.tsx (change preset.pageBg and preset.surfaceBg Tailwind classes to matching bg-[#hex] values) so the visible page background changes.`,
    prompt: `Owner request: ${ownerMessage}
${isBackgroundEdit ? '\nThis is a background/color edit — update globals.css and page.tsx preset colors together.' : ''}

Current files:
${JSON.stringify(filePayload, null, 2)}

Return: { "files": [{ "path": "src/app/globals.css", "content": "..." }], "summary": "short owner-facing note" }`,
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
    return { ok: false, error: 'LLM did not return file edits.' };
  }

  for (const file of result.data.files) {
    const normalized = file.path.replace(/^\/+/, '');
    if (!EDIT_CANDIDATES.includes(normalized) && !normalized.startsWith('src/')) {
      continue;
    }
    const dest = path.join(workspacePath, normalized);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, file.content, 'utf-8');
  }

  return {
    ok: true,
    summary: result.data.summary || 'Updated your website styling and content.',
  };
}
