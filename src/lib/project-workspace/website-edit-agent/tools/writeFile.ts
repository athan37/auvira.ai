import { promises as fs } from 'fs';
import path from 'path';
import { isSafeWritePath, resolveSafePath } from '../../workspaceEditShared';
import type { ToolContext, ToolResult } from '../types';

export async function writeFileTool(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const pathStr = String(args.path || '');
  const content = String(args.content ?? '');

  if (!isSafeWritePath(pathStr)) {
    return { ok: false, error: `Cannot write to blocked or unsafe file: ${pathStr}` };
  }

  const resolved = resolveSafePath(ctx.workspacePath, pathStr);
  if (!resolved) {
    return { ok: false, error: 'Path outside workspace' };
  }

  try {
    if (ctx.gateway) {
      await ctx.gateway.writeFile(pathStr, content);
    } else {
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, 'utf-8');
    }
    ctx.recordChange(pathStr, content);
    return { ok: true, path: pathStr };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Write failed' };
  }
}
