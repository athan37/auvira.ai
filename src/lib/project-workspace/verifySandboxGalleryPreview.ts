import { pageHasGalleryRenderer } from './website-edit-agent/patchGallerySection';
import { validateGalleryInSiteConfigSource } from './website-edit-agent/validateGallerySiteConfig';
import type { WorkspaceAssetAttachment } from './workspaceAssetTypes';
import { verifyEditVisibleInPreview } from './verifyEditVisibleInPreview';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sandbox preview: HTML fetch may lag after restart — also verify siteConfig + static assets.
 */
export async function verifyGalleryEditOnSandbox(input: {
  previewUrl: string;
  siteConfigSource: string;
  pageSource: string;
  attachments: WorkspaceAssetAttachment[];
}): Promise<{ ok: boolean; reason: string; imagesFound: number; htmlLength: number }> {
  const configCheck = validateGalleryInSiteConfigSource(
    input.siteConfigSource,
    input.attachments
  );
  if (!configCheck.ok) {
    return { ok: false, reason: configCheck.reason, imagesFound: 0, htmlLength: 0 };
  }

  if (!pageHasGalleryRenderer(input.pageSource)) {
    return {
      ok: false,
      reason: 'page.tsx missing GallerySection or case "gallery"',
      imagesFound: 0,
      htmlLength: 0,
    };
  }

  await sleep(3000);

  const htmlVerify = await verifyEditVisibleInPreview({
    previewUrl: input.previewUrl,
    imagePaths: input.attachments.map((a) => a.publicUrl),
    sectionPhrases: ['Our products', 'Our work', 'Gallery', 'Product images'],
    timeoutMs: 25_000,
  });

  if (htmlVerify.ok) {
    return {
      ok: true,
      reason: htmlVerify.reason,
      imagesFound: htmlVerify.imagesFound,
      htmlLength: htmlVerify.htmlLength,
    };
  }

  const base = input.previewUrl.replace(/\/$/, '');
  let assetsOk = 0;
  for (const att of input.attachments) {
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

  if (assetsOk >= input.attachments.length) {
    return {
      ok: true,
      reason: `siteConfig gallery OK; ${assetsOk}/${input.attachments.length} images reachable on sandbox (HTML verify: ${htmlVerify.reason})`,
      imagesFound: assetsOk,
      htmlLength: htmlVerify.htmlLength,
    };
  }

  return {
    ok: false,
    reason: `${htmlVerify.reason}; ${assetsOk}/${input.attachments.length} upload URLs reachable on sandbox`,
    imagesFound: assetsOk,
    htmlLength: htmlVerify.htmlLength,
  };
}
