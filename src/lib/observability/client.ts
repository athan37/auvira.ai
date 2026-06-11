import {
  isObservabilityEnabled,
  observabilityApiBaseUrl,
  observabilityApiKey,
  observabilityRequestTimeoutMs,
  observabilityTenantId,
} from './config';
import type { RecordTurnPayload, RecordTurnResponse } from './types';

export interface ObservabilityFetchResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

/** Map fetch/abort failures to user-facing Monitor error text. */
export function formatObservabilityFetchError(
  error: unknown,
  timeoutMs = observabilityRequestTimeoutMs()
): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || /aborted/i.test(error.message)) {
      return `Site Monitor request timed out after ${timeoutMs}ms`;
    }
    return error.message;
  }
  return 'Site Monitor request failed';
}

async function observabilityFetchDetailed<T>(
  path: string,
  init: RequestInit = {},
  options?: { apiPrefix?: string; timeoutMs?: number }
): Promise<ObservabilityFetchResult<T>> {
  if (!isObservabilityEnabled()) {
    return { ok: false, status: 503, data: null, error: 'Site Monitor is not enabled' };
  }

  const apiKey = observabilityApiKey();
  if (!apiKey) {
    return { ok: false, status: 503, data: null, error: 'Site Monitor API key is not configured' };
  }

  const prefix = options?.apiPrefix ?? '/api/v1';
  const timeoutMs = options?.timeoutMs ?? observabilityRequestTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${observabilityApiBaseUrl()}${prefix}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': observabilityTenantId(),
        'X-API-Key': apiKey,
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn('[observability] request failed', {
        path,
        status: response.status,
        body: body.slice(0, 500),
      });
      return {
        ok: false,
        status: response.status,
        data: null,
        error: body.slice(0, 500) || response.statusText,
      };
    }

    const data = (await response.json()) as T;
    return { ok: true, status: response.status, data };
  } catch (error) {
    const message = formatObservabilityFetchError(error, timeoutMs);
    console.warn('[observability] request error', { path, message });
    return { ok: false, status: 0, data: null, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function observabilityFetch<T>(
  path: string,
  init: RequestInit = {},
  options?: { apiPrefix?: string }
): Promise<T | null> {
  const result = await observabilityFetchDetailed<T>(path, init, options);
  return result.ok ? result.data : null;
}

export async function createObservabilityProject(input: {
  projectId: string;
  title: string;
}): Promise<unknown> {
  return observabilityFetch('/projects', {
    method: 'POST',
    body: JSON.stringify({
      project_id: input.projectId,
      title: input.title,
      builder_type: 'la_mue_edit',
    }),
  });
}

export async function createObservabilityConversation(input: {
  projectId: string;
  conversationId: string;
  title?: string;
}): Promise<unknown> {
  return observabilityFetch(`/projects/${encodeURIComponent(input.projectId)}/conversations`, {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: input.conversationId,
      title: input.title ?? 'Editor chat',
    }),
  });
}

export interface ObservabilityConversationRow {
  conversation_id: string;
  title?: string;
  turn_count?: number;
}

/** List conversations registered for a Monitor project. */
export async function listObservabilityConversations(
  projectId: string
): Promise<ObservabilityFetchResult<{ conversations?: ObservabilityConversationRow[] }>> {
  return observabilityFetchDetailed(
    `/projects/${encodeURIComponent(projectId)}/conversations`,
    { method: 'GET' }
  );
}

export interface ObservabilityHealthStatus {
  mongo?: { ok?: boolean };
  phoenix?: { enabled?: boolean; mcp_connected?: boolean };
}

/** Site Monitor readiness (no /api/v1 prefix). */
export async function fetchObservabilityHealth(): Promise<ObservabilityFetchResult<ObservabilityHealthStatus>> {
  return observabilityFetchDetailed('/health/ready', { method: 'GET' }, { apiPrefix: '' });
}

export interface FetchObservabilityIntentBody {
  user_message: string;
  selected_target?: Record<string, unknown> | null;
  conversation_id?: string;
}

export async function fetchObservabilityIntentRaw(input: {
  projectId: string;
  body: FetchObservabilityIntentBody;
}): Promise<Record<string, unknown> | null> {
  return observabilityFetch(`/projects/${encodeURIComponent(input.projectId)}/intent`, {
    method: 'POST',
    body: JSON.stringify(input.body),
  });
}

export async function fetchObservabilityDashboardRaw(input: {
  projectId: string;
  conversationId: string;
  turnLimit?: number;
}): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams();
  if (input.turnLimit != null) params.set('turn_limit', String(input.turnLimit));
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';
  return observabilityFetch(
    `/projects/${encodeURIComponent(input.projectId)}/conversations/${encodeURIComponent(input.conversationId)}/dashboard${suffix}`,
    { method: 'GET' }
  );
}

/** GET dashboard with HTTP status for analyze route error handling. */
export async function fetchObservabilityDashboardDetailed(input: {
  projectId: string;
  conversationId: string;
  turnLimit?: number;
}): Promise<ObservabilityFetchResult<Record<string, unknown>>> {
  const params = new URLSearchParams();
  if (input.turnLimit != null) params.set('turn_limit', String(input.turnLimit));
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';
  return observabilityFetchDetailed(
    `/projects/${encodeURIComponent(input.projectId)}/conversations/${encodeURIComponent(input.conversationId)}/dashboard${suffix}`,
    { method: 'GET' }
  );
}

export async function fetchObservabilityIntentProfileRaw(input: {
  projectId: string;
  turnLimit?: number;
}): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams();
  if (input.turnLimit != null) params.set('turn_limit', String(input.turnLimit));
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';
  return observabilityFetch(`/projects/${encodeURIComponent(input.projectId)}/intent${suffix}`, {
    method: 'GET',
  });
}

export async function fetchObservabilityIntentProfileDetailed(input: {
  projectId: string;
  turnLimit?: number;
}): Promise<ObservabilityFetchResult<Record<string, unknown>>> {
  const params = new URLSearchParams();
  if (input.turnLimit != null) params.set('turn_limit', String(input.turnLimit));
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';
  return observabilityFetchDetailed(
    `/projects/${encodeURIComponent(input.projectId)}/intent${suffix}`,
    { method: 'GET' }
  );
}

export async function fetchObservabilityContextRaw(input: {
  projectId: string;
  conversationId: string;
  latestUserMessage?: string;
}): Promise<{ context?: Record<string, unknown> } | null> {
  const params = new URLSearchParams({ conversation_id: input.conversationId });
  if (input.latestUserMessage) {
    params.set('latest_user_message', input.latestUserMessage);
  }
  return observabilityFetch(
    `/projects/${encodeURIComponent(input.projectId)}/context?${params.toString()}`,
    { method: 'GET' }
  );
}

/** Context may hit Phoenix fallback — allow a longer timeout than turn recording. */
const CONTEXT_FETCH_TIMEOUT_MS = Math.max(12_000, observabilityRequestTimeoutMs() * 2);

export async function fetchObservabilityContextDetailed(input: {
  projectId: string;
  conversationId: string;
  latestUserMessage?: string;
}): Promise<ObservabilityFetchResult<{ context?: Record<string, unknown> }>> {
  const params = new URLSearchParams({ conversation_id: input.conversationId });
  if (input.latestUserMessage) {
    params.set('latest_user_message', input.latestUserMessage);
  }
  return observabilityFetchDetailed(
    `/projects/${encodeURIComponent(input.projectId)}/context?${params.toString()}`,
    { method: 'GET' },
    { timeoutMs: CONTEXT_FETCH_TIMEOUT_MS }
  );
}

export async function postObservabilityTurn(input: {
  projectId: string;
  conversationId: string;
  payload: RecordTurnPayload;
}): Promise<RecordTurnResponse | null> {
  return observabilityFetch<RecordTurnResponse>(
    `/projects/${encodeURIComponent(input.projectId)}/conversations/${encodeURIComponent(input.conversationId)}/turns`,
    {
      method: 'POST',
      body: JSON.stringify(input.payload),
    }
  );
}
