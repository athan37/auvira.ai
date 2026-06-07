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
