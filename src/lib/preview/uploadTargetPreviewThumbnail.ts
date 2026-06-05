import type { TargetPreviewThumbnail } from '@/lib/preview/targetPreviewThumbnail';
import { dataUrlToPreviewFile } from '@/lib/preview/targetPreviewThumbnail';
import type { WorkspaceAssetAttachment } from '@/lib/project-workspace/workspaceAssetTypes';

/** Upload a captured target preview thumbnail to workspace assets. */
export async function uploadTargetPreviewThumbnail(
  projectId: string,
  dataUrl: string,
  captureKind?: TargetPreviewThumbnail['captureKind'],
  dimensions?: { width?: number; height?: number }
): Promise<TargetPreviewThumbnail> {
  const file = dataUrlToPreviewFile(dataUrl);
  const formData = new FormData();
  formData.append('files', file);

  const res = await fetch(`/api/projects/${projectId}/code-agent/upload-assets`, {
    method: 'POST',
    body: formData,
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    attachments?: WorkspaceAssetAttachment[];
  };
  if (!data.ok || !data.attachments?.[0]) {
    throw new Error(data.error ?? 'Target preview upload failed');
  }

  const attachment = data.attachments[0];
  return {
    previewUrl: attachment.previewUrl,
    publicUrl: attachment.publicUrl,
    path: attachment.path,
    width: dimensions?.width,
    height: dimensions?.height,
    captureKind,
  };
}
