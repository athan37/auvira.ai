/** @type {import('next').NextConfig} */

function resolvePublicAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, '');
  }
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (host) {
    const clean = host.replace(/^https?:\/\//, '');
    return `https://${clean}`;
  }
  return 'http://localhost:3000';
}

const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_URL: resolvePublicAppUrl(),
    NEXT_PUBLIC_SITE_AGENT_DEV_BYPASS_AUTH:
      process.env.SITE_AGENT_DEV_BYPASS_AUTH === '1' ? '1' : '',
  },
};

module.exports = nextConfig;
