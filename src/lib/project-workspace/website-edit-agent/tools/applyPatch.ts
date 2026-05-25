import { spawn } from 'child_process';
import { isSafeWritePath, resolveSafePath } from '../../workspaceEditShared';
import type { ToolContext, ToolResult } from '../types';

function parsePatchTarget(patch: string): string | null {
  for (const line of patch.split('\n')) {
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      const part = line.split(/\s+/)[1]?.replace(/^a\//, '').replace(/^b\//, '');
      if (part && part !== '/dev/null') {
        return part;
      }
    }
  }
  return null;
}

function gitApply(workspacePath: string, patch: string): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['apply', '--whitespace=fix'], {
      cwd: workspacePath,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stderr }));
    child.stdin?.write(patch);
    child.stdin?.end();
  });
}

export async function applyPatchTool(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const patch = String(args.patch || '');
  if (!patch) {
    return { ok: false, error: 'No patch provided' };
  }

  const targetFile = parsePatchTarget(patch);
  if (!targetFile) {
    return { ok: false, error: 'Could not parse patch target' };
  }

  if (!isSafeWritePath(targetFile)) {
    return { ok: false, error: `Cannot patch blocked file: ${targetFile}` };
  }

  if (!resolveSafePath(ctx.workspacePath, targetFile)) {
    return { ok: false, error: 'Patch target outside workspace' };
  }

  try {
    const { code, stderr } = await gitApply(ctx.workspacePath, patch);
    if (code !== 0) {
      return { ok: false, error: stderr.slice(0, 500) || 'Patch failed' };
    }
    ctx.recordChange(targetFile);
    return { ok: true, changedFiles: [targetFile] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Patch failed' };
  }
}
