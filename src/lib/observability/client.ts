import {
  isObservabilityEnabled,
  observabilityApiBaseUrl,
  observabilityApiKey,
  observabilityRequestTimeoutMs,
  observabilityTenantId,
} from './config';
import type { RecordTurnPayload, RecordTurnResponse } from './types';

async function observabilityFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T | null> {
  if (!isObservabilityEnabled()) return null;

  const apiKey = observabilityApiKey();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), observabilityRequestTimeoutMs());

  try {
    const response = await fetch(`${observabilityApiBaseUrl()}/api/v1${path}`, {
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
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.warn('[observability] request error', {
      path,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
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

export interface FetchObservabilityIntentBody {
  user_message: string;
  selected_target?: Record<string, unknown> | null;
  conversation_id?: string;
}

export async function fetchObservabilityIntentRaw(input: {
  projectId: string;
  body: FetchObservabilityIntentBody;
}): Promise<Record<string, unknown> | null> {
  return observabilityFetch(
    `/projects/${encodeURIComponent(input.projectId)}/intent`,
    {
      method: 'POST',
      body: JSON.stringify(input.body),
    }
  );
}

export async function fetchObservabilityDashboardRaw(input: {
  projectId: string;
  conversationId: string;
}): Promise<Record<string, unknown> | null> {
  return observabilityFetch(
    `/projects/${encodeURIComponent(input.projectId)}/conversations/${encodeURIComponent(input.conversationId)}/dashboard`,
    { method: 'GET' }
  );
}

export async function fetchObservabilityIntentProfileRaw(input: {
  projectId: string;
}): Promise<Record<string, unknown> | null> {
  return observabilityFetch(`/projects/${encodeURIComponent(input.projectId)}/intent`, {
    method: 'GET',
  });
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
