/**
 * Vercel API credentials for deploying customer sites from the app.
 * Use SITE_AGENT_VERCEL_* in Vercel project env — names starting with VERCEL_ are reserved.
 */

export function getVercelApiToken(): string {
  return (
    process.env.SITE_AGENT_VERCEL_TOKEN?.trim() ||
    process.env.VERCEL_API_TOKEN?.trim() ||
    process.env.VERCEL_TOKEN?.trim() ||
    ''
  );
}

export function getVercelTeamId(): string | undefined {
  const id =
    process.env.SITE_AGENT_VERCEL_TEAM_ID?.trim() ||
    process.env.VERCEL_API_TEAM_ID?.trim() ||
    process.env.VERCEL_TEAM_ID?.trim();
  return id || undefined;
}

export function hasVercelApiToken(): boolean {
  return getVercelApiToken().length > 0;
}
