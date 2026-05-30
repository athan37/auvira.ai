import { executeTool } from '@/lib/project-workspace/website-edit-agent/toolRegistry';
import { getProfileForMode } from '@/lib/project-workspace/website-edit-agent/profiles';
import type { ToolContext } from '@/lib/project-workspace/website-edit-agent/types';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';

const MAX_ITERATIONS = 8;
const MAX_CHANGED_FILES = 3;

export interface RestrictedFallbackResult {
  ok: boolean;
  changedFiles: string[];
  summary: string;
  error?: string;
  verificationPassed: boolean;
}

function isPathAllowed(path: string, allowedWritePaths: string[]): boolean {
  const normalized = path.replace(/\\/g, '/');
  return allowedWritePaths.some((allowed) => {
    const a = allowed.replace(/\\/g, '/');
    return normalized === a || normalized.endsWith(`/${a}`);
  });
}

/**
 * Restricted file-tool loop for custom_code_edit only.
 */
export async function runRestrictedCustomCodeEdit(
  editContext: EditContext,
  ownerMessage: string,
  onVerification: () => Promise<boolean>
): Promise<RestrictedFallbackResult> {
  const profile = getProfileForMode(editContext.mode);
  const changedFiles: string[] = [];
  const readPaths = new Set<string>();
  const beforeFiles: Record<string, string> = {};
  const afterFiles: Record<string, string> = {};

  const ctx: ToolContext = {
    workspacePath: editContext.workspacePath,
    mode: editContext.mode,
    ownerMessage,
    changedFiles,
    beforeFiles,
    afterFiles,
    gateway: editContext.gateway,
    recordChange: (relPath, content) => {
      if (!changedFiles.includes(relPath)) changedFiles.push(relPath);
      if (content !== undefined) afterFiles[relPath] = content;
    },
  };

  const messages: string[] = [
    `${ownerMessage}\n\nAllowed write paths: ${editContext.allowedWritePaths.join(', ')}\nYou must read_file before write_file on each path.`,
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const { getLLMClient } = await import('@/lib/llm/llmClient');
    const llm = getLLMClient();
    const result = await llm.generateJSON<{ thought?: string; action?: { tool: string; args: Record<string, unknown> } }>({
      system: profile.systemPrompt,
      prompt: messages.join('\n\n'),
      schema: {
        type: 'object',
        required: ['action'],
        properties: {
          thought: { type: 'string' },
          action: {
            type: 'object',
            required: ['tool', 'args'],
            properties: {
              tool: { type: 'string' },
              args: { type: 'object' },
            },
          },
        },
      },
      temperature: 0,
      maxTokens: 2048,
    });

    const toolName = result.data?.action?.tool;
    const args = result.data?.action?.args ?? {};
    if (!toolName) {
      return { ok: false, changedFiles, summary: '', error: 'Invalid tool action', verificationPassed: false };
    }

    if (toolName === 'finish') {
      if (changedFiles.length === 0) {
        messages.push('Cannot finish without file changes.');
        continue;
      }
      const verificationPassed = await onVerification();
      if (!verificationPassed) {
        return {
          ok: false,
          changedFiles,
          summary: '',
          error: 'Verification failed before finish',
          verificationPassed: false,
        };
      }
      return {
        ok: true,
        changedFiles,
        summary: String(args.summary ?? args.ownerMessage ?? 'Updated your website.'),
        verificationPassed: true,
      };
    }

    if (toolName === 'read_file') {
      const path = String(args.path ?? '');
      readPaths.add(path);
    }

    if (toolName === 'write_file' || toolName === 'apply_patch') {
      const path =
        toolName === 'write_file'
          ? String(args.path ?? '')
          : String(args.path ?? '');

      if (path && !isPathAllowed(path, editContext.allowedWritePaths)) {
        messages.push(`Write blocked: ${path} is not in allowedWritePaths.`);
        continue;
      }

      if (path && !readPaths.has(path)) {
        messages.push(`You must read_file("${path}") before writing.`);
        continue;
      }

      if (changedFiles.length >= MAX_CHANGED_FILES && !changedFiles.includes(path)) {
        messages.push(`Max ${MAX_CHANGED_FILES} changed files reached.`);
        continue;
      }
    }

    const toolResult = await executeTool(toolName, args, ctx, profile);
    messages.push(JSON.stringify(toolResult).slice(0, 2000));
  }

  return {
    ok: false,
    changedFiles,
    summary: '',
    error: 'Restricted fallback max iterations reached',
    verificationPassed: false,
  };
}
