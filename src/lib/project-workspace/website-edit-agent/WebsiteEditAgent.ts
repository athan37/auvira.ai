import { promises as fs } from 'fs';
import path from 'path';
import { getLLMClient } from '@/lib/llm/llmClient';
import { GeminiProvider } from '@/lib/llm/geminiProvider';
import type { LLMProvider } from '@/lib/llm/types';
import { OWNER_ACTION_SCHEMA } from './actionSchema';
import { executeTool } from './toolRegistry';
import { getProfileForMode } from './profiles';
import type {
  AgentAction,
  AgentStepEvent,
  ToolContext,
  WebsiteEditAgentOptions,
  WebsiteEditAgentResult,
} from './types';
import { verifyEditApplied, summarizeActualChanges } from './verifyEditApplied';
import { isBlockedWorkspacePath } from '../workspaceEditShared';

function getAgentLlm(): LLMProvider {
  if (process.env.WEBSITE_EDIT_LLM_PROVIDER === 'gemini') {
    return new GeminiProvider();
  }
  return getLLMClient();
}

async function captureWorkspaceFiles(
  workspacePath: string,
  mode: 'gitlab' | 'static',
  gateway?: import('../workspaceGateway').WorkspaceGateway
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  if (mode === 'static') {
    for (const fn of ['index.html', 'styles.css', 'site.json']) {
      try {
        files[fn] = gateway
          ? await gateway.readFile(fn)
          : await fs.readFile(path.join(workspacePath, fn), 'utf-8');
      } catch {
        /* missing */
      }
    }
    return files;
  }

  if (gateway) {
    const paths = await gateway.searchFiles('*');
    for (const rel of paths.slice(0, 200)) {
      try {
        const content = await gateway.readFile(rel);
        if (content.length < 100_000) files[rel] = content;
      } catch {
        /* skip */
      }
    }
    return files;
  }

  async function walk(dir: string, relBase = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') {
        continue;
      }
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), rel);
      } else if (entry.isFile() && !isBlockedWorkspacePath(rel)) {
        try {
          const content = await fs.readFile(path.join(dir, entry.name), 'utf-8');
          if (content.length < 100_000) {
            files[rel] = content;
          }
        } catch {
          /* skip */
        }
      }
    }
  }

  await walk(workspacePath);
  return files;
}

async function captureAfterState(
  workspacePath: string,
  changedFiles: string[],
  gateway?: import('../workspaceGateway').WorkspaceGateway
): Promise<Record<string, string>> {
  const after: Record<string, string> = {};
  for (const fn of changedFiles) {
    try {
      after[fn] = gateway
        ? await gateway.readFile(fn)
        : await fs.readFile(path.join(workspacePath, fn), 'utf-8');
    } catch {
      /* missing */
    }
  }
  return after;
}

function emitStep(
  onStep: ((e: AgentStepEvent) => void) | undefined,
  id: string,
  label: string,
  status: AgentStepEvent['status']
) {
  onStep?.({ type: 'step', id, label, status });
}

function parseAction(data: unknown): AgentAction | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const action = d.action as Record<string, unknown> | undefined;
  if (!action || typeof action.tool !== 'string') return null;
  return {
    thought: String(d.thought ?? ''),
    action: {
      tool: action.tool,
      args: (action.args as Record<string, unknown>) ?? {},
    },
  };
}

/**
 * Cursor-like tool loop for owner website edits.
 */
export async function runAgentLoop(
  options: WebsiteEditAgentOptions,
  onStep?: (event: AgentStepEvent) => void
): Promise<WebsiteEditAgentResult> {
  const profile = getProfileForMode(options.mode);
  const llm = getAgentLlm();
  const changedFiles: string[] = [];
  const beforeFiles = await captureWorkspaceFiles(
    options.workspacePath,
    options.mode,
    options.gateway
  );
  const afterFiles: Record<string, string> = {};

  const ctx: ToolContext = {
    workspacePath: options.workspacePath,
    mode: options.mode,
    ownerMessage: options.ownerMessage,
    changedFiles,
    beforeFiles,
    afterFiles,
    gateway: options.gateway,
    recordChange: (relPath, content) => {
      if (!changedFiles.includes(relPath)) {
        changedFiles.push(relPath);
      }
      if (content !== undefined) {
        afterFiles[relPath] = content;
      }
    },
  };

  const messages: string[] = [];
  let applyLabel = 'Applying your requested change';
  const agentPrompt = options.agentPrompt?.trim() || options.ownerMessage;

  emitStep(onStep, 'understand', 'Understanding your request', 'active');
  messages.push(
    `${agentPrompt}\n\nRespond with your first action to edit the website. Use read_file only if the snapshot above is insufficient.`
  );
  emitStep(onStep, 'understand', 'Understanding your request', 'completed');

  emitStep(onStep, 'open_draft', 'Opening your website draft', 'active');
  emitStep(onStep, 'open_draft', 'Opening your website draft', 'completed');
  emitStep(onStep, 'inspect_design', 'Checking the current website', 'active');
  emitStep(onStep, 'inspect_design', 'Checking the current website', 'completed');
  emitStep(onStep, 'apply_change', applyLabel, 'active');

  for (let iteration = 0; iteration < profile.maxIterations; iteration++) {
    const conversation = messages.join('\n\n');
    let result = await llm.generateJSON<AgentAction>({
      system: profile.systemPrompt,
      prompt: conversation,
      schema: OWNER_ACTION_SCHEMA,
    });

    if (!result.ok || !parseAction(result.data)) {
      const validationHint =
        result.validation?.errors && result.validation.errors.length > 0
          ? `Schema errors: ${JSON.stringify(result.validation.errors).slice(0, 600)}`
          : 'Response must include thought and action.tool with action.args.';
      result = await llm.generateJSON<AgentAction>({
        system: profile.systemPrompt,
        prompt: `${conversation}\n\nYour last response was invalid JSON. ${validationHint}\nReturn only: { "thought": "...", "action": { "tool": "tool_name", "args": { } } }`,
        schema: OWNER_ACTION_SCHEMA,
      });
    }

    const parsed = parseAction(result.data);
    if (!parsed) {
      emitStep(onStep, 'apply_change', applyLabel, 'failed');
      return {
        ok: false,
        strategy: 'agent_loop',
        error: 'LLM returned invalid action JSON twice.',
        ownerMessage: 'I had trouble understanding that request. Please try again.',
      };
    }

    const { tool: toolName, args } = parsed.action;

    if (toolName === 'finish') {
      if (changedFiles.length === 0) {
        messages.push(
          'Cannot finish yet — no files were changed. Use write_file with the full updated file content (or apply_patch), then call finish again.'
        );
        continue;
      }

      emitStep(onStep, 'apply_change', applyLabel, 'completed');

      const capturedAfter = await captureAfterState(
        options.workspacePath,
        changedFiles,
        options.gateway
      );
      const afterSnapshot: Record<string, string> = { ...beforeFiles, ...capturedAfter };

      const verification = verifyEditApplied(
        options.ownerMessage,
        beforeFiles,
        afterSnapshot
      );

      if (!verification.ok) {
        emitStep(onStep, 'validate', 'Checking the preview', 'failed');
        return {
          ok: false,
          strategy: 'agent_loop',
          error: verification.reason,
          ownerMessage: "I couldn't safely apply that change. Please try rephrasing your request.",
        };
      }

      emitStep(onStep, 'validate', 'Checking the preview', 'active');
      emitStep(onStep, 'validate', 'Checking the preview', 'completed');
      emitStep(onStep, 'finish', 'Preview updated', 'active');
      emitStep(onStep, 'finish', 'Preview updated', 'completed');

      const ownerMessage =
        String(args.ownerMessage || '') ||
        summarizeActualChanges(options.ownerMessage, beforeFiles, afterSnapshot);

      return {
        ok: true,
        strategy: 'agent_loop',
        summary: ownerMessage,
        ownerMessage,
        changedFiles: [...changedFiles],
      };
    }

    const toolResult = await executeTool(toolName, args, ctx, profile);
    const resultStr = JSON.stringify(toolResult).slice(0, 2000);

    let toolFeedback = `Assistant thought: ${parsed.thought}\nAction: ${toolName}(${JSON.stringify(args)})\n\nResult: ${resultStr}`;

    if (!toolResult.ok && toolName === 'apply_patch') {
      toolFeedback +=
        '\n\nPatch failed. Use write_file with the complete updated file content instead of apply_patch.';
    } else if (!toolResult.ok && toolName === 'write_file') {
      toolFeedback +=
        '\n\nWrite failed. Fix the path or content and try again, or read_file first to confirm the target.';
    }

    messages.push(toolFeedback);
  }

  emitStep(onStep, 'apply_change', applyLabel, 'failed');
  const partialHint =
    changedFiles.length > 0
      ? ' Some files were updated but the edit did not finish — check the preview and try again.'
      : '';
  return {
    ok: false,
    strategy: 'agent_loop',
    error: 'Max iterations reached',
    ownerMessage: `I ran out of steps to complete your request.${partialHint} Try a shorter, specific edit (e.g. "change background to blue" or "change hero headline to: Your text here").`,
  };
}
