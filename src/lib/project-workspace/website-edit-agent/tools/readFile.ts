import { promises as fs } from 'fs';
import { resolveSafePath } from '../../workspaceEditShared';
import type { ToolContext, ToolResult } from '../types';

const MAX_BYTES = 80_000;

export async function readFileTool(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const pathStr = String(args.path || '');
  const resolved = resolveSafePath(ctx.workspacePath, pathStr);
  if (!resolved) {
    return { ok: false, error: 'Path outside workspace or blocked' };
  }

  try {
    const content = await fs.readFile(resolved, 'utf-8');
    return {
      ok: true,
      path: pathStr,
      content: content.slice(0, MAX_BYTES),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Read failed' };
  }
}
