/** Production Site Monitor when OBSERVABILITY_API_URL is unset. */
export const DEFAULT_OBSERVABILITY_API_URL =
  'https://la-mue-site-monitor-production.up.railway.app';

function isObservabilityExplicitlyDisabled(): boolean {
  return process.env.OBSERVABILITY_ENABLED === '0';
}

function isCoachingExplicitlyDisabled(): boolean {
  return process.env.OBSERVABILITY_COACHING_ENABLED === '0';
}

/**
 * True when observability is on (default) and API key + URL are available.
 * Set OBSERVABILITY_ENABLED=0 to opt out.
 */
export function isObservabilityEnabled(): boolean {
  if (isObservabilityExplicitlyDisabled()) return false;
  return Boolean(
    observabilityApiBaseUrl() && process.env.OBSERVABILITY_API_KEY?.trim()
  );
}

/**
 * True when coaching hints may be injected into planEdit (default on when observability is on).
 * Set OBSERVABILITY_COACHING_ENABLED=0 to record turns without changing the planner.
 */
export function isObservabilityCoachingEnabled(): boolean {
  if (!isObservabilityEnabled()) return false;
  if (isCoachingExplicitlyDisabled()) return false;
  return true;
}

export function observabilityTenantId(): string {
  return process.env.OBSERVABILITY_TENANT_ID?.trim() || 'la-mue';
}

export function observabilityApiBaseUrl(): string {
  const raw =
    process.env.OBSERVABILITY_API_URL?.trim() || DEFAULT_OBSERVABILITY_API_URL;
  return raw.replace(/\/$/, '');
}

export function observabilityRequestTimeoutMs(): number {
  const parsed = parseInt(process.env.OBSERVABILITY_TIMEOUT_MS || '5000', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
}

const DEFAULT_PHOENIX_APP_URL = 'https://app.phoenix.arize.com';

/** Base URL for Phoenix Cloud (trace links in admin/debug UI). */
export function phoenixAppUrl(): string {
  const raw = process.env.PHOENIX_APP_URL?.trim() || DEFAULT_PHOENIX_APP_URL;
  return raw.replace(/\/$/, '');
}

/**
 * Build a Phoenix trace URL when a template is configured; otherwise null.
 * Set PHOENIX_TRACE_URL_TEMPLATE with `{traceId}` placeholder for deep links.
 */
export function phoenixTraceUrl(traceId: string): string | null {
  const id = traceId?.trim();
  if (!id) return null;

  const template = process.env.PHOENIX_TRACE_URL_TEMPLATE?.trim();
  if (template && template.includes('{traceId}')) {
    return template.replace('{traceId}', encodeURIComponent(id));
  }

  return null;
}

/** Whether observability debug UI (grades, trace links) is enabled in the client. */
export function isObservabilityDebugUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_OBSERVABILITY_DEBUG === '1';
}
