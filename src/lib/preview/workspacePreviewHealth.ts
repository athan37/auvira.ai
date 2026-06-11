import { readSiteConfigFromWorkspace } from '@/lib/site-manager/siteConfigParser';

/** Port where the Auvira.ai Next app runs locally (`npm run dev`). Never use for workspace preview. */
export function getSiteAgentDevPort(): number {
  const raw = process.env.PORT || process.env.SITE_AGENT_DEV_PORT || '3000';
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

export function isReservedWorkspacePreviewPort(port: number): boolean {
  return port === getSiteAgentDevPort();
}

/** Match visible text in HTML including basic entity encoding (`&` → `&amp;`, etc.). */
export function htmlIncludesText(html: string, text: string): boolean {
  if (!text) return false;
  if (html.includes(text)) return true;
  const encoded = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return encoded !== text && html.includes(encoded);
}

/** HTML signatures of the Auvira.ai shell, not a customer workspace site. */
export function isSiteAgentShellHtml(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes('/projects/new') ||
    lower.includes('preparing your project') ||
    (lower.includes('sign in') && lower.includes('/auth/signin')) ||
    (lower.includes('/dashboard') && lower.includes('/projects/'))
  );
}

export async function fetchPreviewHtml(port: number, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok && res.status !== 307 && res.status !== 308) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Extract first Next.js chunk/script path from dev server HTML. */
export function extractPreviewChunkPath(html: string): string | null {
  const match = html.match(/(?:src|href)=["'](\/_next\/static\/[^"']+)["']/);
  return match?.[1] ?? null;
}

/** True when a representative workspace chunk responds (dev compile finished). */
export async function checkWorkspacePreviewChunksReady(
  port: number,
  html: string,
  timeoutMs = 8000
): Promise<boolean> {
  const chunkPath = extractPreviewChunkPath(html);
  if (!chunkPath) return true;

  try {
    const res = await fetch(`http://127.0.0.1:${port}${chunkPath}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * True when something is listening and it looks like this project's workspace site,
 * not the Auvira.ai app on the main dev port.
 */
export async function checkWorkspacePreviewHealthy(
  port: number,
  workspacePath: string,
  timeoutMs = 8000
): Promise<boolean> {
  if (isReservedWorkspacePreviewPort(port)) {
    return false;
  }

  const html = await fetchPreviewHtml(port, timeoutMs);
  if (!html || html.length < 800) {
    return false;
  }

  if (isSiteAgentShellHtml(html)) {
    return false;
  }

  const chunksReady = await checkWorkspacePreviewChunksReady(port, html, timeoutMs);
  if (!chunksReady) {
    return false;
  }

  const { config } = await readSiteConfigFromWorkspace(workspacePath);
  const businessName = config?.businessName?.trim();
  if (businessName && businessName.length >= 6) {
    const probes = [
      businessName.slice(0, Math.min(40, businessName.length)),
      businessName.slice(0, 16),
    ].filter((p, i, arr) => p.length >= 6 && arr.indexOf(p) === i);
    if (probes.some((p) => htmlIncludesText(html, p))) {
      return true;
    }
  }

  return html.includes('/_next/') || html.includes('siteConfig');
}
