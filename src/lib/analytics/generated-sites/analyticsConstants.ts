export const ANALYTICS_CONFIG_PATH = 'src/lib/analyticsConfig.ts';
export const ANALYTICS_ATTRS_PATH = 'src/lib/analyticsAttrs.ts';
export const ANALYTICS_RUNTIME_PATH = 'src/components/analytics/WebsiteAnalytics.tsx';
export const SITE_CONFIG_PATH = 'src/lib/siteConfig.ts';
export const PAGE_PATH = 'src/app/page.tsx';

export const ANALYTICS_EVENT_TYPES = ['view', 'focus', 'click'] as const;
export const ANALYTICS_COMPONENT_TYPES = ['hero', 'section', 'cta'] as const;

export const MAX_ANALYTICS_EVENTS_PER_BATCH = 50;
export const MAX_ANALYTICS_BODY_BYTES = 64 * 1024;

export const DEFAULT_ANALYTICS_COLLECT_PATH = '/api/analytics/collect';

export function resolveAnalyticsCollectEndpoint(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_AGENT_APP_URL || process.env.NEXTAUTH_URL;
  if (explicit) {
    return `${explicit.replace(/\/+$/, '')}${DEFAULT_ANALYTICS_COLLECT_PATH}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}${DEFAULT_ANALYTICS_COLLECT_PATH}`;
  }

  return '';
}
