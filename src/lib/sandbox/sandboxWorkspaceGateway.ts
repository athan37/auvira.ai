import type { Sandbox } from '@vercel/sandbox';
import crypto from 'crypto';
import path from 'path';
import {
  BLOCKED_PATH_PATTERNS,
  isBlockedWorkspacePath,
  resolveSafePath,
} from '@/lib/project-workspace/workspaceEditShared';
import type { WorkspaceGateway } from '@/lib/project-workspace/workspaceGateway';
import { getProjectSandbox } from './sandboxClient';
import { writeSandboxFile } from './sandboxFsWrite';
import { SANDBOX_WORKDIR } from './types';

export function absSandboxPath(relPath: string): string {
  const normalized = relPath.replace(/^\/+/, '');
  return path.posix.join(SANDBOX_WORKDIR, normalized);
}

/** File operations against a Vercel Sandbox VM working directory. */
export class SandboxGateway implements WorkspaceGateway {
  constructor(private readonly sandbox: Sandbox) {}

  getWorkspacePath(): string {
    return SANDBOX_WORKDIR;
  }

  isSandbox(): boolean {
    return true;
  }

  async readFile(relPath: string): Promise<string> {
    if (!resolveSafePath(SANDBOX_WORKDIR, relPath)) {
      throw new Error('Path outside workspace or blocked');
    }
    return this.sandbox.fs.readFile(absSandboxPath(relPath), 'utf8');
  }

  async writeFile(relPath: string, content: string): Promise<void> {
    const resolved = resolveSafePath(SANDBOX_WORKDIR, relPath);
    if (!resolved) throw new Error('Path outside workspace');
    const abs = absSandboxPath(relPath);
    const dir = path.posix.dirname(abs);
    try {
      await this.sandbox.fs.mkdir(dir, { recursive: true });
    } catch {
      await this.sandbox.runCommand({ cmd: 'mkdir', args: ['-p', dir] });
    }
    await writeSandboxFile(this.sandbox, abs, content);
  }

  async searchFiles(pattern: string): Promise<string[]> {
    const result = await this.sandbox.runCommand({
      cmd: 'rg',
      args: ['--files', '--hidden', '--glob', pattern, '.'],
      cwd: SANDBOX_WORKDIR,
    });
    if (result.exitCode !== 0 && result.exitCode !== 1) return [];
    const stdout = await result.stdout();
    return stdout
      .split('\n')
      .map((f: string) => f.trim())
      .filter((f: string) => f && !isBlockedWorkspacePath(f))
      .slice(0, 500);
  }

  async searchCode(
    query: string,
    fileGlob?: string
  ): Promise<Array<{ path: string; line: number; content: string }>> {
    const args = ['-n', '--hidden'];
    if (fileGlob) args.push('--glob', fileGlob);
    args.push('--', query, '.');

    const result = await this.sandbox.runCommand({
      cmd: 'rg',
      args,
      cwd: SANDBOX_WORKDIR,
    });
    if (result.exitCode !== 0 && result.exitCode !== 1) return [];
    const stdout = await result.stdout();
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
    const patchPath = '/tmp/site-agent-patch.diff';
    await this.sandbox.fs.writeFile(patchPath, patch, 'utf8');
    const result = await this.sandbox.runCommand({
      cmd: 'git',
      args: ['apply', '--whitespace=fix', patchPath],
      cwd: SANDBOX_WORKDIR,
    });
    if (result.exitCode !== 0) {
      const stderr = await result.stderr();
      return { ok: false, error: stderr.slice(0, 500) || 'Patch failed' };
    }
    return { ok: true };
  }

  async computeHashes(): Promise<Record<string, string>> {
    const hashes: Record<string, string> = {};
    const safeExtensions = new Set([
      '.html',
      '.htm',
      '.css',
      '.scss',
      '.sass',
      '.less',
      '.tsx',
      '.jsx',
      '.ts',
      '.js',
      '.json',
      '.svg',
      '.md',
      '.txt',
    ]);

    async function walk(absDir: string, relBase: string) {
      let entries;
      try {
        entries = await sandbox.fs.readdir(absDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (BLOCKED_PATH_PATTERNS.includes(entry.name)) continue;
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') {
          continue;
        }

        const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
        const absPath = path.posix.join(absDir, entry.name);

        if (entry.isDirectory()) {
          await walk(absPath, relPath);
        } else if (entry.isFile()) {
          const ext = path.posix.extname(entry.name).toLowerCase();
          if (!safeExtensions.has(ext)) continue;
          if (isBlockedWorkspacePath(relPath)) continue;
          try {
            const content = await sandbox.fs.readFile(absPath, 'utf8');
            hashes[relPath] = crypto
              .createHash('sha256')
              .update(content)
              .digest('hex')
              .slice(0, 16);
          } catch {
            // skip unreadable
          }
        }
      }
    }

    const sandbox = this.sandbox;
    await walk(SANDBOX_WORKDIR, '');
    return hashes;
  }
}

export async function getSandboxGateway(projectId: string): Promise<SandboxGateway> {
  const sandbox = await getProjectSandbox(projectId);
  return new SandboxGateway(sandbox);
}
