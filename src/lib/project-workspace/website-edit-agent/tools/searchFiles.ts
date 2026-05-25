import { execFile } from 'child_process';
import { promisify } from 'util';
import { isBlockedWorkspacePath } from '../../workspaceEditShared';
import type { ToolContext, ToolResult } from '../types';

const execFileAsync = promisify(execFile);

export async function searchFilesTool(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const pattern = String(args.pattern || '*');

  try {
    const { stdout } = await execFileAsync(
      'rg',
      ['--files', '--hidden', '--glob', pattern, '.'],
      { cwd: ctx.workspacePath, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 }
    );

    const files = stdout
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f && !isBlockedWorkspacePath(f));

    return { ok: true, files: files.slice(0, 500) };
  } catch (err) {
    const execErr = err as { code?: number; stdout?: string };
    if (execErr.code === 1) {
      return { ok: true, files: [] };
    }
    return { ok: false, error: err instanceof Error ? err.message : 'search_files failed' };
  }
}
