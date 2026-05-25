import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import {
  computeWorkspaceHashes,
  isBlockedWorkspacePath,
  resolveSafePath,
} from '@/lib/project-workspace/workspaceEditShared';
import type { WorkspaceGateway } from '@/lib/project-workspace/workspaceGateway';

const execFileAsync = promisify(execFile);

/**
 * Local filesystem workspace (scratch git-workspaces / project-workspaces).
 */
export class LocalFsGateway implements WorkspaceGateway {
  constructor(private readonly workspacePath: string) {}

  getWorkspacePath(): string {
    return this.workspacePath;
  }

  isSandbox(): boolean {
    return false;
  }

  async readFile(relPath: string): Promise<string> {
    const resolved = resolveSafePath(this.workspacePath, relPath);
    if (!resolved) throw new Error('Path outside workspace or blocked');
    return fs.readFile(resolved, 'utf-8');
  }

  async writeFile(relPath: string, content: string): Promise<void> {
    const resolved = resolveSafePath(this.workspacePath, relPath);
    if (!resolved) throw new Error('Path outside workspace');
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf-8');
  }

  async searchFiles(pattern: string): Promise<string[]> {
    const { stdout } = await execFileAsync(
      'rg',
      ['--files', '--hidden', '--glob', pattern, '.'],
      { cwd: this.workspacePath, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 }
    );
    return stdout
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f && !isBlockedWorkspacePath(f))
      .slice(0, 500);
  }

  async searchCode(
    query: string,
    fileGlob?: string
  ): Promise<Array<{ path: string; line: number; content: string }>> {
    const rgArgs = ['-n', '--hidden'];
    if (fileGlob) rgArgs.push('--glob', fileGlob);
    rgArgs.push('--', query, '.');

    const { stdout } = await execFileAsync('rg', rgArgs, {
      cwd: this.workspacePath,
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
    return matches;
  }

  async applyPatch(patch: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      const child = spawn('git', ['apply', '--whitespace=fix'], {
        cwd: this.workspacePath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr?.on('data', (d) => {
        stderr += d.toString();
      });
      child.on('error', (err) => resolve({ ok: false, error: err.message }));
      child.on('close', (code) => {
        if (code === 0) resolve({ ok: true });
        else resolve({ ok: false, error: stderr.slice(0, 500) || 'Patch failed' });
      });
      child.stdin?.write(patch);
      child.stdin?.end();
    });
  }

  async computeHashes(): Promise<Record<string, string>> {
    return computeWorkspaceHashes(this.workspacePath);
  }
}
