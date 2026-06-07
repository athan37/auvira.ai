/** True when OBSERVABILITY_ENABLED=1 and API key + URL are configured. */
export function isObservabilityEnabled(): boolean {
  if (process.env.OBSERVABILITY_ENABLED !== '1') return false;
  return Boolean(
    process.env.OBSERVABILITY_API_URL?.trim() &&
      process.env.OBSERVABILITY_API_KEY?.trim()
  );
}

/** True when coaching hints may be injected into planEdit (requires observability on). */
export function isObservabilityCoachingEnabled(): boolean {
  if (!isObservabilityEnabled()) return false;
  return process.env.OBSERVABILITY_COACHING_ENABLED === '1';
}

export function observabilityTenantId(): string {
  return process.env.OBSERVABILITY_TENANT_ID?.trim() || 'la-mue';
}

export function observabilityApiBaseUrl(): string {
  const raw = process.env.OBSERVABILITY_API_URL?.trim() ?? '';
  return raw.replace(/\/$/, '');
}

export function observabilityRequestTimeoutMs(): number {
  const parsed = parseInt(process.env.OBSERVABILITY_TIMEOUT_MS || '5000', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
}
