import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { getPublicAppUrl } from '@/lib/appUrl';
import { fetchHtmlFromSandboxLoopback } from '@/lib/sandbox/fetchSandboxPreviewHtml';
import {
  genericSectionRendersItemImages,
  pageHasGalleryRenderer,
  applyUniversalImageRenderer,
} from './website-edit-agent/universalImageRenderer';
import {
  sectionItemsHaveImageUrls,
  validateGalleryInSiteConfigSource,
} from './website-edit-agent/validateGallerySiteConfig';
import type { WorkspaceAssetAttachment } from './workspaceAssetTypes';
import { countUploadedImagesInHtml } from './previewImageHtml';

/** Section titles from siteConfig that should appear in preview HTML when images render. */
export function gallerySectionTitlesFromSource(siteConfigSource: string): string[] {
  const config = parseSiteConfigSource(siteConfigSource);
  if (!config?.sections?.length) return [];
  return config.sections
    .filter(
      (s) =>
        String(s.type ?? '').toLowerCase() === 'gallery' ||
        sectionItemsHaveImageUrls(s.items)
    )
    .map((s) => String(s.title ?? '').trim())
    .filter((t) => t.length > 1);
}

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

function pageCanRenderGalleryItems(pageSource: string): boolean {
  if (pageHasGalleryRenderer(pageSource)) return true;
  if (genericSectionRendersItemImages(pageSource)) return true;
  const simulated = applyUniversalImageRenderer(pageSource);
  return pageHasGalleryRenderer(simulated.content) || genericSectionRendersItemImages(simulated.content);
}

async function fetchExternalPreviewHtml(previewUrl: string): Promise<string> {
  const sep = previewUrl.includes('?') ? '&' : '?';
  const res = await fetch(`${previewUrl}${sep}_verify=${Date.now()}`, {
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(25_000),
  });
  return res.text();
}

/** Same URL path the preview iframe uses (rewrites /uploads and /_next). */
export function buildPreviewProxyVerifyUrl(projectId: string): string {
  const base = getPublicAppUrl().replace(/\/$/, '');
  return `${base}/api/projects/${projectId}/preview/proxy/`;
}

async function fetchProxyPreviewHtml(projectId: string): Promise<string> {
  const url = `${buildPreviewProxyVerifyUrl(projectId)}?_verify=${Date.now()}`;
  const res = await fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) return '';
  return res.text();
}

/**
 * Sandbox preview: require uploaded image paths in rendered HTML (not upload URL alone).
 * Prefers the app preview proxy (same as iframe), then sandbox loopback, then direct sandbox URL.
 */
export async function verifyGalleryEditOnSandbox(input: {
  previewUrl: string;
  projectId?: string;
  siteConfigSource: string;
  pageSource: string;
  attachments: WorkspaceAssetAttachment[];
  sectionPhrases?: string[];
}): Promise<{ ok: boolean; reason: string; imagesFound: number; htmlLength: number }> {
  const configCheck = validateGalleryInSiteConfigSource(
    input.siteConfigSource,
    input.attachments
  );
  if (!configCheck.ok) {
    return { ok: false, reason: configCheck.reason, imagesFound: 0, htmlLength: 0 };
  }

  if (!pageCanRenderGalleryItems(input.pageSource)) {
    return {
      ok: false,
      reason: 'page.tsx cannot render gallery item images (missing gallery/generic renderer)',
      imagesFound: 0,
      htmlLength: 0,
    };
  }

  const publicUrls = input.attachments.map((a) => a.publicUrl);
  const configTitles = gallerySectionTitlesFromSource(input.siteConfigSource);
  const retries = 8;
  const delayMs = 3500;

  let lastHtml = '';
  let lastImagesFound = 0;
  let verifySource = 'direct';

  await sleep(4000);

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      await sleep(delayMs);
    }

    let html = '';
    if (input.projectId) {
      try {
        html = await fetchProxyPreviewHtml(input.projectId);
        if (html.length > 1500) verifySource = 'proxy';
      } catch {
        /* fall through */
      }
    }
    if (html.length < 1500 && input.projectId) {
      html = (await fetchHtmlFromSandboxLoopback(input.projectId)) ?? '';
      if (html.length > 1500) verifySource = 'loopback';
    }
    if (html.length < 1500) {
      try {
        html = await fetchExternalPreviewHtml(input.previewUrl);
        if (html.length > 1500) verifySource = 'direct';
      } catch {
        continue;
      }
    }

    lastHtml = html;
    if (html.length < 1500) {
      continue;
    }

    lastImagesFound = countUploadedImagesInHtml(html, publicUrls);
    if (lastImagesFound >= publicUrls.length) {
      const phraseMatched = [...configTitles, ...(input.sectionPhrases ?? [])].some((phrase) =>
        html.toLowerCase().includes(phrase.toLowerCase())
      );
      void phraseMatched;
      return {
        ok: true,
        reason:
          verifySource === 'proxy'
            ? `Preview proxy shows ${lastImagesFound}/${publicUrls.length} uploaded image(s).`
            : verifySource === 'loopback'
              ? `Sandbox loopback preview shows ${lastImagesFound}/${publicUrls.length} uploaded image(s).`
              : `Preview shows ${lastImagesFound}/${publicUrls.length} uploaded image(s).`,
        imagesFound: lastImagesFound,
        htmlLength: html.length,
      };
    }
  }

  const assetsOk = await countReachableUploadAssets(input.previewUrl, input.attachments);

  return {
    ok: false,
    reason:
      assetsOk >= input.attachments.length
        ? `Preview HTML (${lastHtml.length} bytes, source=${verifySource}) does not include uploaded image paths (${lastImagesFound}/${publicUrls.length} found). Files exist on sandbox; the page template may not be rendering gallery items yet.`
        : `Preview HTML missing images (${lastImagesFound}/${publicUrls.length}); ${assetsOk}/${input.attachments.length} upload URLs reachable.`,
    imagesFound: lastImagesFound,
    htmlLength: lastHtml.length,
  };
}
