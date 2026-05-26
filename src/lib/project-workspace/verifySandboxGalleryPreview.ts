import { canRenderUploadedImages } from './website-edit-agent/universalImageRenderer';
import { validateGalleryInSiteConfigSource } from './website-edit-agent/validateGallerySiteConfig';
import type { WorkspaceAssetAttachment } from './workspaceAssetTypes';
import { verifyEditVisibleInPreview } from './verifyEditVisibleInPreview';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Count how many uploaded files respond on the sandbox dev server (diagnostics only). */
export async function countReachableUploadAssets(
  previewUrl: string,
  attachments: WorkspaceAssetAttachment[]
): Promise<number> {
  const base = previewUrl.replace(/\/$/, '');
  let assetsOk = 0;
  for (const att of attachments) {
    try {
      const res = await fetch(`${base}${att.publicUrl}?t=${Date.now()}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) assetsOk += 1;
    } catch {
      /* try next */
    }
  }
  return assetsOk;
}

/**
 * Sandbox preview: require uploaded image paths in rendered HTML (not upload URL alone).
 */
export async function verifyGalleryEditOnSandbox(input: {
  previewUrl: string;
  siteConfigSource: string;
  pageSource: string;
  attachments: WorkspaceAssetAttachment[];
  /** Extra section titles/phrases to look for in HTML (optional). */
  sectionPhrases?: string[];
}): Promise<{ ok: boolean; reason: string; imagesFound: number; htmlLength: number }> {
  const configCheck = validateGalleryInSiteConfigSource(
    input.siteConfigSource,
    input.attachments
  );
  if (!configCheck.ok) {
    return { ok: false, reason: configCheck.reason, imagesFound: 0, htmlLength: 0 };
  }

  if (!canRenderUploadedImages(input.pageSource)) {
    return {
      ok: false,
      reason: 'page.tsx cannot render gallery item images (missing gallery/generic renderer)',
      imagesFound: 0,
      htmlLength: 0,
    };
  }

  await sleep(3000);

  const htmlVerify = await verifyEditVisibleInPreview({
    previewUrl: input.previewUrl,
    imagePaths: input.attachments.map((a) => a.publicUrl),
    sectionPhrases: [
      ...(input.sectionPhrases ?? []),
      'Our products',
      'Our work',
      'Gallery',
      'Product images',
    ],
    timeoutMs: 25_000,
    retries: 6,
    delayMs: 3000,
  });

  if (htmlVerify.ok) {
    return {
      ok: true,
      reason: htmlVerify.reason,
      imagesFound: htmlVerify.imagesFound,
      htmlLength: htmlVerify.htmlLength,
    };
  }

  const assetsOk = await countReachableUploadAssets(input.previewUrl, input.attachments);

  return {
    ok: false,
    reason:
      assetsOk >= input.attachments.length
        ? `${htmlVerify.reason} Upload files exist (${assetsOk}/${input.attachments.length}) but the preview page did not render them yet — refresh the preview or retry the edit.`
        : `${htmlVerify.reason}; ${assetsOk}/${input.attachments.length} upload URLs reachable on sandbox`,
    imagesFound: htmlVerify.imagesFound,
    htmlLength: htmlVerify.htmlLength,
  };
}
