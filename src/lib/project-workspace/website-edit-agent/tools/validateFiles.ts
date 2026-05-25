import { isBlockedWorkspacePath } from '../../workspaceEditShared';
import type { ToolContext, ToolResult } from '../types';

export async function validateFilesTool(
  _args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const errors: string[] = [];

  for (const fn of ctx.changedFiles) {
    if (isBlockedWorkspacePath(fn)) {
      errors.push(`Changed blocked file: ${fn}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, validated: [...ctx.changedFiles] };
}
