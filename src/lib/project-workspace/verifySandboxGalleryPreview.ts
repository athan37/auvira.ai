import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { fetchSandboxPreviewHtmlForVerify } from '@/lib/project-workspace/fetchSandboxPreviewHtmlForVerify';
import { fetchHtmlFromSandboxLoopback } from '@/lib/sandbox/fetchSandboxPreviewHtml';
import {
  genericSectionRendersItemImages,
  pageHasGalleryRenderer,
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

function localAppOrigin(): string {
  return (
    process.env.SITE_AGENT_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    'http://127.0.0.1:3000'
  ).replace(/\/$/, '');
}

function isLoopbackPreviewUrl(previewUrl: string): boolean {
  return /127\.0\.0\.1|localhost/.test(previewUrl);
}

/** Count how many uploaded files respond on the sandbox dev server (diagnostics only). */
export async function countReachableUploadAssets(
  previewUrl: string,
  attachments: WorkspaceAssetAttachment[],
  projectId?: string
): Promise<number> {
  const base = previewUrl.replace(/\/$/, '');
  const useProxy = Boolean(projectId) && isLoopbackPreviewUrl(previewUrl);
  const proxyBase = useProxy
    ? `${localAppOrigin()}/api/projects/${projectId}/preview/proxy`
    : base;
  let assetsOk = 0;
  for (const att of attachments) {
    try {
      const assetUrl = useProxy ? `${proxyBase}${att.publicUrl}` : `${base}${att.publicUrl}`;
      const res = await fetch(`${assetUrl}?t=${Date.now()}`, {
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

/** Uses on-disk page source only — do not simulate patches (would hide `case gallery: return null`). */
function pageCanRenderGalleryItems(pageSource: string): boolean {
  return pageHasGalleryRenderer(pageSource) || genericSectionRendersItemImages(pageSource);
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

/** @deprecated Use fetchSandboxPreviewHtmlForVerify — kept for tests referencing proxy URL shape */
export function buildPreviewProxyVerifyUrl(projectId: string): string {
  return `/api/projects/${projectId}/preview/proxy/`;
}

async function fetchPreviewHtmlForAttempt(input: {
  projectId?: string;
  previewUrl: string;
}): Promise<{ html: string; source: string }> {
  if (input.projectId && isLoopbackPreviewUrl(input.previewUrl)) {
    try {
      const proxyUrl = `${localAppOrigin()}/api/projects/${input.projectId}/preview/proxy/?_sa_verify=${Date.now()}`;
      const res = await fetch(proxyUrl, {
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000),
      });
      if (res.ok) {
        const text = await res.text();
        if (text.length >= 500) {
          return { html: text, source: 'app_proxy' };
        }
      }
    } catch {
      /* fall through */
    }
  }

  if (input.projectId) {
    try {
      const internal = await fetchSandboxPreviewHtmlForVerify(input.projectId);
      if (internal.length >= 500) {
        return { html: internal, source: 'sandbox_fetch' };
      }
    } catch {
      /* fall through */
    }

    const loopback = (await fetchHtmlFromSandboxLoopback(input.projectId)) ?? '';
    if (loopback.length >= 500) {
      return { html: loopback, source: 'loopback' };
    }
  }

  try {
    const direct = await fetchExternalPreviewHtml(input.previewUrl);
    if (direct.length >= 500) {
      return { html: direct, source: 'direct' };
    }
    return { html: direct, source: 'direct' };
  } catch {
    return { html: '', source: 'none' };
  }
}

/**
 * Sandbox preview: require uploaded image paths in rendered HTML (not upload URL alone).
 * Polls until all image paths appear or retries are exhausted.
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
  const requiredCount = publicUrls.length;
  const retries = 10;
  const delayMs = 3500;

  let lastHtml = '';
  let lastImagesFound = 0;
  let verifySource = 'none';

  await sleep(5000);

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      await sleep(delayMs);
    }

    const { html, source } = await fetchPreviewHtmlForAttempt({
      projectId: input.projectId,
      previewUrl: input.previewUrl,
    });

    lastHtml = html;
    verifySource = source;

    if (html.length < 500) {
      continue;
    }

    lastImagesFound = countUploadedImagesInHtml(html, publicUrls);
    if (lastImagesFound >= requiredCount) {
      return {
        ok: true,
        reason:
          verifySource === 'sandbox_fetch'
            ? `Sandbox preview shows ${lastImagesFound}/${requiredCount} uploaded image(s).`
            : verifySource === 'loopback'
              ? `Sandbox loopback preview shows ${lastImagesFound}/${requiredCount} uploaded image(s).`
              : `Preview shows ${lastImagesFound}/${requiredCount} uploaded image(s).`,
        imagesFound: lastImagesFound,
        htmlLength: html.length,
      };
    }
  }

  const assetsOk = await countReachableUploadAssets(
    input.previewUrl,
    input.attachments,
    input.projectId
  );
  const configHasUrls = publicUrls.every((url) => input.siteConfigSource.includes(url));

  return {
    ok: false,
    reason:
      assetsOk >= requiredCount
        ? `Preview HTML (${lastHtml.length} bytes, source=${verifySource}) does not include uploaded image paths (${lastImagesFound}/${requiredCount} found). Files exist on sandbox${configHasUrls ? '; siteConfig has URLs' : ''}; the page template may not be rendering gallery items yet.`
        : `Preview HTML missing images (${lastImagesFound}/${requiredCount}); ${assetsOk}/${requiredCount} upload URLs reachable.`,
    imagesFound: lastImagesFound,
    htmlLength: lastHtml.length,
  };
}
