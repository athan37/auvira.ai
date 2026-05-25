import { promises as fs } from 'fs';
import path from 'path';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { getGitWorkspacePath } from './gitWorkspaceManager';
import { getWorkspaceUploadDir } from './workspaceAssets';
import { isSandboxPreviewEnabled } from '@/lib/runtime/isSandboxPreviewEnabled';
import { getProjectSandbox } from '@/lib/sandbox/sandboxClient';
import { absSandboxPath } from '@/lib/sandbox/sandboxWorkspaceGateway';
import { SANDBOX_WORKDIR } from '@/lib/sandbox/types';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function contentTypeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

/**
 * Map public URL path (/uploads/foo.png) to workspace-relative path (public/uploads/foo.png).
 */
export function resolveUploadAssetRelPath(
  pathSegments: string[],
  mode: 'gitlab' | 'static'
): string | null {
  const joined = pathSegments.join('/').replace(/^\/+/, '');
  if (!joined || joined.includes('..')) return null;

  const uploadDir = getWorkspaceUploadDir(mode);
  if (joined.startsWith('uploads/')) {
    return mode === 'gitlab' ? `public/${joined}` : `assets/${joined}`;
  }
  if (joined.startsWith(`${uploadDir}/`)) {
    return joined;
  }
  return null;
}

/**
 * Read an uploaded workspace image for chat thumbnails and asset preview API.
 */
export async function readWorkspaceAsset(
  projectId: string,
  pathSegments: string[]
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const project = await getOwnerProject(projectId);
  if (!project) return null;

  const useSandbox =
    isSandboxPreviewEnabled() &&
    Boolean(project.gitlab?.repoUrl) &&
    (project.preview?.previewMode === 'sandbox' || project.codeWorkspace?.sandboxWorkspace);

  const mode: 'gitlab' | 'static' = project.gitlab?.repoUrl ? 'gitlab' : 'static';
  const relPath = resolveUploadAssetRelPath(pathSegments, mode);
  if (!relPath) return null;

  if (useSandbox) {
    try {
      const sandbox = await getProjectSandbox(projectId);
      const abs = absSandboxPath(relPath);
      const buffer = await sandbox.fs.readFile(abs);
      return { buffer, contentType: contentTypeForPath(relPath) };
    } catch {
      return null;
    }
  }

  const workspacePath = project.gitlab?.repoUrl
    ? getGitWorkspacePath(projectId)
    : project.codeWorkspace?.workspacePath;
  if (!workspacePath) return null;

  try {
    const abs = path.join(workspacePath, relPath);
    const buffer = await fs.readFile(abs);
    return { buffer, contentType: contentTypeForPath(relPath) };
  } catch {
    return null;
  }
}
