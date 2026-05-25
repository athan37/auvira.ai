export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_UPLOAD = 8;

export interface WorkspaceAssetAttachment {
  id: string;
  path: string;
  publicUrl: string;
  previewUrl: string;
  originalName: string;
  mimeType: string;
  size: number;
}
