import { readSiteConfigFromWorkspace } from '@/lib/site-manager/siteConfigParser';

/** Port where the Site Agent Next app runs locally (`npm run dev`). Never use for workspace preview. */
export function getSiteAgentDevPort(): number {
  const raw = process.env.PORT || process.env.SITE_AGENT_DEV_PORT || '3000';
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

export function isReservedWorkspacePreviewPort(port: number): boolean {
  return port === getSiteAgentDevPort();
}

/** HTML signatures of the Site Agent shell, not a customer workspace site. */
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

/**
 * True when something is listening and it looks like this project's workspace site,
 * not the Site Agent app on the main dev port.
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

  const { config } = await readSiteConfigFromWorkspace(workspacePath);
  const businessName = config?.businessName?.trim();
  if (businessName && businessName.length >= 6) {
    const probes = [
      businessName.slice(0, Math.min(40, businessName.length)),
      businessName.slice(0, 16),
    ].filter((p, i, arr) => p.length >= 6 && arr.indexOf(p) === i);
    return probes.some((p) => html.includes(p));
  }

  return html.includes('/_next/') || html.includes('siteConfig');
}
