import { promises as fs } from 'fs';
import path from 'path';
import type { IWebsiteProject } from '@/models/WebsiteProject';
import { getGitWorkspacePath } from '@/lib/project-workspace/gitWorkspaceManager';
import { scratchPath } from '@/lib/runtime/scratchDir';

const BLOCKED_PATTERNS = [
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

const INDEX_FALLBACKS = [
  'index.html',
  'out/index.html',
  'public/index.html',
  '.next/server/app/index.html',
];

export function resolveWorkspaceDir(project: IWebsiteProject, projectId: string): string {
  const source = project.codeWorkspace?.source || 'generated';
  if (source === 'gitlab' && project.gitlab?.repoUrl) {
    return getGitWorkspacePath(projectId);
  }
  return scratchPath('project-workspaces', projectId);
}

export function isBlockedServePath(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  if (lower.includes('..')) return true;
  return BLOCKED_PATTERNS.some(
    (blocked) =>
      lower === blocked ||
      lower.startsWith(`${blocked}/`) ||
      lower.includes(`/${blocked}/`) ||
      lower.endsWith(`/${blocked}`)
  );
}

export function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

export async function resolvePreviewFile(
  workspaceDir: string,
  requestedPath: string
): Promise<{ filePath: string; resolved: boolean } | null> {
  const normalized = requestedPath.replace(/^\/+/, '') || 'index.html';

  if (isBlockedServePath(normalized)) {
    return null;
  }

  const directPath = path.resolve(workspaceDir, normalized);
  if (!directPath.startsWith(workspaceDir)) {
    return null;
  }

  try {
    const stat = await fs.stat(directPath);
    if (stat.isFile()) {
      return { filePath: directPath, resolved: true };
    }
  } catch {
    // try fallbacks for index
  }

  if (normalized === 'index.html' || normalized === '') {
    for (const candidate of INDEX_FALLBACKS) {
      const candidatePath = path.resolve(workspaceDir, candidate);
      if (!candidatePath.startsWith(workspaceDir)) continue;
      try {
        const stat = await fs.stat(candidatePath);
        if (stat.isFile()) {
          return { filePath: candidatePath, resolved: true };
        }
      } catch {
        // next candidate
      }
    }
    return null;
  }

  return null;
}

export function buildPreviewLoadingHtml(projectId: string, label: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="3" />
  <title>Loading preview</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 40rem; margin: 0 auto; color: #1f2937; text-align: center; }
    .spinner { width: 2rem; height: 2rem; border: 3px solid #e5e7eb; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { color: #4b5563; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>${label}</p>
  <p style="font-size:0.75rem;color:#9ca3af">Project ${projectId}</p>
</body>
</html>`;
}

export function buildPreviewNotReadyHtml(
  projectId: string,
  reason: string,
  options?: { loading?: boolean }
): string {
  if (options?.loading) {
    return buildPreviewLoadingHtml(projectId, reason);
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Preview not ready</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 40rem; margin: 0 auto; color: #1f2937; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #4b5563; line-height: 1.5; }
    code { background: #f3f4f6; padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.875rem; }
  </style>
</head>
<body>
  <h1>Preview not ready</h1>
  <p>${reason}</p>
  <p>Project: <code>${projectId}</code></p>
</body>
</html>`;
}
