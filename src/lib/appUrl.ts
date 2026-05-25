/**
 * Public app base URL. On Vercel, derived from VERCEL_URL when NEXT_PUBLIC_APP_URL is unset.
 */

function fromVercelHost(host: string | undefined): string | undefined {
  if (!host?.trim()) return undefined;
  const h = host.trim().replace(/^https?:\/\//, '');
  return `https://${h}`;
}

/** Server/runtime base URL for links and callbacks. */
export function getPublicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const vercel =
    fromVercelHost(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    fromVercelHost(process.env.VERCEL_URL);
  if (vercel) return vercel;

  return 'http://localhost:3000';
}
