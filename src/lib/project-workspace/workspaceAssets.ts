import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { resolveSafePath } from './workspaceEditShared';
import {
  ALLOWED_IMAGE_MIME_TYPES as ALLOWED_IMAGE_MIME_LIST,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_UPLOAD,
  type WorkspaceAssetAttachment,
} from './workspaceAssetTypes';

export {
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_UPLOAD,
  type WorkspaceAssetAttachment,
} from './workspaceAssetTypes';

const ALLOWED_IMAGE_MIME_TYPES = new Set<string>(ALLOWED_IMAGE_MIME_LIST);

export const IMAGE_FILE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
]);

/** Relative folder inside the workspace for owner-uploaded images. */
export function getWorkspaceUploadDir(mode: 'gitlab' | 'static'): string {
  return mode === 'gitlab' ? 'public/uploads' : 'assets/uploads';
}

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/svg+xml':
      return '.svg';
    default:
      return '.bin';
  }
}

function sanitizeBaseName(name: string): string {
  const base = path.basename(name, path.extname(name));
  const safe = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return safe || 'image';
}

export function buildAssetPreviewUrl(
  projectId: string,
  mode: 'gitlab' | 'static',
  publicUrl: string
): string {
  const clean = publicUrl.replace(/^\/+/, '');
  if (mode === 'gitlab') {
    return `/api/projects/${projectId}/preview/proxy/${clean}`;
  }
  return `/api/projects/${projectId}/code-preview/${clean}`;
}

/**
 * Save owner-selected images into the project workspace for use in the site.
 */
export async function saveWorkspaceImages(input: {
  workspacePath: string;
  mode: 'gitlab' | 'static';
  projectId: string;
  files: Array<{ name: string; mimeType: string; buffer: Buffer }>;
}): Promise<WorkspaceAssetAttachment[]> {
  const { workspacePath, mode, projectId, files } = input;
  if (files.length === 0) return [];
  if (files.length > MAX_IMAGES_PER_UPLOAD) {
    throw new Error(`You can upload up to ${MAX_IMAGES_PER_UPLOAD} images at a time.`);
  }

  const uploadDir = getWorkspaceUploadDir(mode);
  const absUploadDir = resolveSafePath(workspacePath, uploadDir);
  if (!absUploadDir) {
    throw new Error('Invalid upload directory.');
  }
  await fs.mkdir(absUploadDir, { recursive: true });

  const saved: WorkspaceAssetAttachment[] = [];

  for (const file of files) {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimeType)) {
      throw new Error(`Unsupported image type: ${file.mimeType}`);
    }
    if (file.buffer.length > MAX_IMAGE_BYTES) {
      throw new Error(`Each image must be ${MAX_IMAGE_BYTES / (1024 * 1024)}MB or smaller.`);
    }

    const ext = extensionForMime(file.mimeType);
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const filename = `${sanitizeBaseName(file.name)}-${id}${ext}`;
    const relativePath = `${uploadDir}/${filename}`;
    const absPath = resolveSafePath(workspacePath, relativePath);
    if (!absPath) {
      throw new Error('Could not resolve upload path.');
    }

    await fs.writeFile(absPath, file.buffer);

    const publicUrl =
      mode === 'gitlab' ? `/uploads/${filename}` : `/assets/uploads/${filename}`;

    saved.push({
      id,
      path: relativePath,
      publicUrl,
      previewUrl: buildAssetPreviewUrl(projectId, mode, publicUrl),
      originalName: file.name,
      mimeType: file.mimeType,
      size: file.buffer.length,
    });
  }

  return saved;
}
