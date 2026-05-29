import { checkPreviewUrlHealthy } from '@/lib/preview/waitForPreviewReady';
import { countUploadedImagesInHtml } from './previewImageHtml';

export interface VerifyPreviewInput {
  previewUrl: string;
  /** Public paths like /uploads/foo.png from uploaded attachments. */
  imagePaths?: string[];
  /** Phrases that should appear when a section was added (any match helps). */
  sectionPhrases?: string[];
  timeoutMs?: number;
  /** Poll attempts when preview HTML lags after a dev-server restart. */
  retries?: number;
  /** Delay between poll attempts (ms). */
  delayMs?: number;
}

export interface VerifyPreviewResult {
  ok: boolean;
  reason: string;
  httpStatus?: number;
  htmlLength: number;
  imagesFound: number;
  phraseMatched: boolean;
  /** True when preview was polled for exact siteConfig presentation classes. */
  presentationClassPolled?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withCacheBust(url: string, attempt: number): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_verify=${Date.now()}_${attempt}`;
}

/**
 * Confirms the live/sandbox preview HTML actually reflects an edit (not just upload + chat text).
 */
export async function verifyEditVisibleInPreview(
  input: VerifyPreviewInput
): Promise<VerifyPreviewResult> {
  const imagePaths = (input.imagePaths ?? []).map((p) => p.replace(/^\//, ''));
  const phrases = input.sectionPhrases ?? ['Our products', 'Product documentation', 'Product images'];
  const retries = input.retries ?? 4;
  const delayMs = input.delayMs ?? 2500;

  let lastStatus = 0;
  let lastHtml = '';
  let lastLength = 0;

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      await sleep(delayMs);
    }

    const healthy = await checkPreviewUrlHealthy(input.previewUrl, 12_000);
    if (!healthy && attempt < retries - 1) {
      continue;
    }

    try {
      const res = await fetch(withCacheBust(input.previewUrl, attempt), {
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(input.timeoutMs ?? 20_000),
      });
      lastStatus = res.status;
      lastHtml = await res.text();
      lastLength = lastHtml.length;
    } catch (err) {
      if (attempt === retries - 1) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Preview fetch failed',
          httpStatus: lastStatus,
          htmlLength: lastLength,
          imagesFound: 0,
          phraseMatched: false,
        };
      }
      continue;
    }

    if (lastLength < 1500) {
      continue;
    }

    const imagesFound = countUploadedImagesInHtml(
      lastHtml,
      imagePaths.map((p) => (p.startsWith('/') ? p : `/${p}`))
    );

    const phraseMatched = phrases.some((phrase) =>
      lastHtml.toLowerCase().includes(phrase.toLowerCase())
    );

    const needsImages = imagePaths.length > 0;
    if (needsImages && imagesFound === 0) {
      continue;
    }

    if (needsImages && imagesFound < Math.min(imagePaths.length, 1)) {
      continue;
    }

    return {
      ok: true,
      reason: needsImages
        ? `Preview shows ${imagesFound}/${imagePaths.length} uploaded image(s).`
        : 'Preview HTML loaded after edit.',
      httpStatus: lastStatus,
      htmlLength: lastLength,
      imagesFound,
      phraseMatched,
    };
  }

  return {
    ok: false,
    reason:
      imagePaths.length > 0
        ? `Preview loaded (${lastLength} bytes) but none of the uploaded image paths appeared in the page HTML. The edit may not have been applied to the preview server.`
        : `Preview did not return usable HTML (status ${lastStatus}, ${lastLength} bytes).`,
    httpStatus: lastStatus,
    htmlLength: lastLength,
    imagesFound: 0,
    phraseMatched: false,
  };
}
