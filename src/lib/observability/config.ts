/** Production Site Monitor when OBSERVABILITY_API_URL is unset. */
export const DEFAULT_OBSERVABILITY_API_URL =
  'https://la-mue-site-monitor-production.up.railway.app';

/** Relative path to optional shipped read-only Monitor client key (override via env). */
export const BUNDLED_OBSERVABILITY_ENV_PATH = 'config/observability-public.env';

let cachedBundledApiKey: string | undefined | null = null;

function isObservabilityExplicitlyDisabled(): boolean {
  return process.env.OBSERVABILITY_ENABLED === '0';
}

function isCoachingExplicitlyDisabled(): boolean {
  return process.env.OBSERVABILITY_COACHING_ENABLED === '0';
}

/** Read shared read-only key shipped in repo (see config/observability-public.env). */
export function readBundledObservabilityApiKey(): string | undefined {
  if (cachedBundledApiKey !== null) return cachedBundledApiKey;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path') as typeof import('node:path');
    const filePath = path.join(process.cwd(), BUNDLED_OBSERVABILITY_ENV_PATH);
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^OBSERVABILITY_API_KEY=(.+)$/m);
    cachedBundledApiKey = match?.[1]?.trim() || undefined;
  } catch {
    cachedBundledApiKey = undefined;
  }
  return cachedBundledApiKey;
}

/** Resolve Monitor API key: env override, then bundled public client key. */
export function observabilityApiKey(): string | undefined {
  return process.env.OBSERVABILITY_API_KEY?.trim() || readBundledObservabilityApiKey();
}

/**
 * True when observability is on (default). Set OBSERVABILITY_ENABLED=0 to opt out.
 * Does not require OBSERVABILITY_API_KEY in .env — uses bundled config/observability-public.env.
 */
export function isObservabilityEnabled(): boolean {
  if (isObservabilityExplicitlyDisabled()) return false;
  return Boolean(observabilityApiBaseUrl());
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

/**
 * When true, skip Monitor POST /intent and use local hardcoded sentences only.
 * Set OBSERVABILITY_INTENT_HARDCODE=1 for dev testing before Monitor ships the endpoint.
 */
export function isHardcodedIntentForced(): boolean {
  const raw = process.env.OBSERVABILITY_INTENT_HARDCODE?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'always';
}

/**
 * When Monitor returns no sentence, synthesize a detailed local intent (default on).
 * Set OBSERVABILITY_INTENT_HARDCODE=0 to disable fallback.
 */
export function isHardcodedIntentFallbackEnabled(): boolean {
  const raw = process.env.OBSERVABILITY_INTENT_HARDCODE?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return true;
}
