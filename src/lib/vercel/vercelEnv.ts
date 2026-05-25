/**
 * Vercel API credentials. Use VERCEL_API_* on Vercel-hosted projects;
 * VERCEL_TOKEN / VERCEL_TEAM_ID remain supported for local .env.
 */

export function getVercelApiToken(): string {
  return (
    process.env.VERCEL_API_TOKEN?.trim() ||
    process.env.VERCEL_TOKEN?.trim() ||
    ''
  );
}

export function getVercelTeamId(): string | undefined {
  const id =
    process.env.VERCEL_API_TEAM_ID?.trim() ||
    process.env.VERCEL_TEAM_ID?.trim();
  return id || undefined;
}

export function hasVercelApiToken(): boolean {
  return getVercelApiToken().length > 0;
}
