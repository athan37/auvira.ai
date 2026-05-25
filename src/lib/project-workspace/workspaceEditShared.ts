/**
 * Shared workspace path checks and file hash utilities for edit agents.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getScratchRoot } from '@/lib/runtime/scratchDir';

function allowedWorkspaceRoots(): string[] {
  const root = getScratchRoot();
  return [
    path.join(root, 'git-workspaces'),
    path.join(root, 'project-workspaces'),
  ];
}

export const BLOCKED_PATH_PATTERNS = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  'private.key',
  'id_rsa',
  'id_ed25519',
  '.pem',
  '.key',
  '.p12',
  '.crt',
];

export const SAFE_WRITE_EXTENSIONS = new Set([
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

const DEFAULT_SAFE_EXTENSIONS = new Set([
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
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.ico',
]);

export const WORKSPACE_BINARY_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.ico',
]);

export const PUBLISHABLE_EXTENSIONS = new Set([
  ...SAFE_WRITE_EXTENSIONS,
  ...WORKSPACE_BINARY_EXTENSIONS,
]);

function isBinaryWorkspaceExtension(ext: string): boolean {
  return WORKSPACE_BINARY_EXTENSIONS.has(ext.toLowerCase());
}

async function hashWorkspaceFile(absPath: string, ext: string): Promise<string> {
  if (isBinaryWorkspaceExtension(ext)) {
    const buffer = await fs.readFile(absPath);
    return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  }
  const content = await fs.readFile(absPath, 'utf-8');
  return computeHash(content);
}

export function isAllowedWorkspacePath(workspacePath: string): boolean {
  const resolved = path.resolve(workspacePath);
  return allowedWorkspaceRoots().some((root) => resolved.startsWith(path.resolve(root)));
}

export function isSafeFileExtension(ext: string): boolean {
  return SAFE_WRITE_EXTENSIONS.has(ext.toLowerCase());
}

export function resolveSafePath(
  workspacePath: string,
  relativePath: string
): string | null {
  const normalized = relativePath.replace(/^\/+/, '');
  const resolved = path.resolve(workspacePath, normalized);
  const workspaceRoot = path.resolve(workspacePath);
  if (!resolved.startsWith(workspaceRoot + path.sep) && resolved !== workspaceRoot) {
    return null;
  }
  if (isBlockedWorkspacePath(normalized)) {
    return null;
  }
  return resolved;
}

const EXTENSIONLESS_PUBLISH_FILES = new Set([
  'Makefile',
  'Dockerfile',
  'LICENSE',
  'README',
  'README.md',
]);

export function isSafeWritePath(relativePath: string): boolean {
  if (isBlockedWorkspacePath(relativePath)) {
    return false;
  }

  const normalized = relativePath.replace(/\\/g, '/').replace(/\/+$/, '');
  if (!normalized) return false;

  const base = path.posix.basename(normalized);
  if (!base) return false;

  const ext = path.extname(base).toLowerCase();
  if (SAFE_WRITE_EXTENSIONS.has(ext)) {
    return true;
  }

  return ext === '' && EXTENSIONLESS_PUBLISH_FILES.has(base);
}

/** Paths that may be committed to GitLab (includes owner-uploaded images). */
export function isSafePublishPath(relativePath: string): boolean {
  if (isBlockedWorkspacePath(relativePath)) {
    return false;
  }

  const normalized = relativePath.replace(/\\/g, '/').replace(/\/+$/, '');
  if (!normalized) return false;

  const base = path.posix.basename(normalized);
  if (!base) return false;

  const ext = path.extname(base).toLowerCase();
  if (PUBLISHABLE_EXTENSIONS.has(ext)) {
    return true;
  }

  return ext === '' && EXTENSIONLESS_PUBLISH_FILES.has(base);
}

export function isBlockedWorkspacePath(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  return BLOCKED_PATH_PATTERNS.some(
    (blocked) =>
      lower === blocked ||
      lower.startsWith(`${blocked}/`) ||
      lower.includes(`/${blocked}/`)
  );
}

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/** Compute file hashes for safe files in a workspace. */
export async function computeWorkspaceHashes(
  workspacePath: string,
  allowedExtensions: Set<string> = DEFAULT_SAFE_EXTENSIONS
): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};

  async function walk(dir: string, relativeBase = '') {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (BLOCKED_PATH_PATTERNS.includes(entry.name)) continue;
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') {
            continue;
          }
          await walk(
            path.join(dir, entry.name),
            relativeBase ? `${relativeBase}/${entry.name}` : entry.name
          );
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!allowedExtensions.has(ext)) continue;

          const relPath = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;
          if (isBlockedWorkspacePath(relPath)) continue;

          try {
            hashes[relPath] = await hashWorkspaceFile(path.join(dir, entry.name), ext);
          } catch {
            // skip unreadable
          }
        }
      }
    } catch {
      // skip unreadable dir
    }
  }

  await walk(workspacePath);
  return hashes;
}

/** Compare before/after hashes and return changed relative paths. */
export function getChangedFilesFromHashes(
  beforeHashes: Record<string, string>,
  afterHashes: Record<string, string>
): string[] {
  const changed: string[] = [];

  for (const [fn, hash] of Object.entries(afterHashes)) {
    if (!beforeHashes[fn] || beforeHashes[fn] !== hash) {
      changed.push(fn);
    }
  }

  for (const fn of Object.keys(beforeHashes)) {
    if (!afterHashes[fn]) {
      changed.push(fn);
    }
  }

  return changed;
}
