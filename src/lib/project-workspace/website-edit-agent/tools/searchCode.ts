import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ToolContext, ToolResult } from '../types';

const execFileAsync = promisify(execFile);

export async function searchCodeTool(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const query = String(args.query || '');
  const fileGlob = args.file_glob ? String(args.file_glob) : '';

  if (!query) {
    return { ok: false, error: 'query is required' };
  }

  try {
    const rgArgs = ['-n', '--hidden'];
    if (fileGlob) {
      rgArgs.push('--glob', fileGlob);
    }
    // Explicit `.` keeps ripgrep scoped to the workspace (avoids parent-dir scans that can hang).
    rgArgs.push('--', query, '.');

    const { stdout } = await execFileAsync('rg', rgArgs, {
      cwd: ctx.workspacePath,
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024,
    });

    const matches: Array<{ path: string; line: number; content: string }> = [];
    for (const line of stdout.split('\n').slice(0, 100)) {
      if (!line.trim()) continue;
      const parts = line.split(':', 3);
      if (parts.length >= 3) {
        matches.push({
          path: parts[0],
          line: parseInt(parts[1], 10) || 0,
          content: parts[2].slice(0, 200),
        });
      }
    }

    return { ok: true, matches };
  } catch (err) {
    const execErr = err as { code?: number };
    if (execErr.code === 1) {
      return { ok: true, matches: [] };
    }
    return { ok: false, error: err instanceof Error ? err.message : 'search_code failed' };
  }
}
