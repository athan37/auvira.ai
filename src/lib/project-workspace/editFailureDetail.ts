/**
 * Build copy-friendly edit failure reports for job logs and the chat UI.
 * Never include secrets (tokens, .env values).
 */

export type EditFailureStage =
  | 'agent_failed'
  | 'validation_failed'
  | 'preview_restart_failed'
  | 'blocked_paths'
  | 'no_changes'
  | 'workspace_prepare'
  | 'unexpected_error'
  | 'unknown';

export interface EditFailureReportInput {
  jobId: string;
  projectId: string;
  stage: EditFailureStage | string;
  ownerMessage: string;
  /** Primary technical message (agent error, validation excerpt, etc.). */
  technicalMessage?: string;
  error?: unknown;
  context?: Record<string, unknown>;
}

export interface EditFailureReport {
  /** Multi-line block optimized for copy/paste into issues or support. */
  copyText: string;
  /** Structured fields stored on the edit job log. */
  metadata: Record<string, unknown>;
}

const REDACT_PATTERNS = [
  /(gitlab|oauth2|x-api-key|authorization|bearer|password|token)([=:\s]+)[^\s&]+/gi,
  /(GITLAB_TOKEN|MINIMAX_API_KEY|VERCEL_[A-Z_]+)=[^\s]+/gi,
];

function redactSecrets(text: string): string {
  let out = text;
  for (const pattern of REDACT_PATTERNS) {
    out = out.replace(pattern, (_, label: string, sep: string) => `${label}${sep}[REDACTED]`);
  }
  return out;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}… [truncated ${text.length - max} chars]`;
}

/** Extract safe fields from thrown values (incl. Vercel Sandbox APIError). */
export function serializeThrownError(error: unknown): Record<string, unknown> {
  if (error == null) {
    return { message: 'Unknown error (null)' };
  }
  if (typeof error !== 'object') {
    return { message: String(error) };
  }

  const err = error as Error & {
    json?: unknown;
    text?: string;
    sessionId?: string;
    sandboxName?: string;
    response?: { status?: number; statusText?: string; url?: string };
  };

  const out: Record<string, unknown> = {
    name: err.name || 'Error',
    message: redactSecrets(err.message || String(error)),
  };

  if (err.stack) {
    out.stack = redactSecrets(
      err.stack
        .split('\n')
        .slice(0, 20)
        .join('\n')
    );
  }

  if (err.sessionId) out.sandboxSessionId = err.sessionId;
  if (err.sandboxName) out.sandboxName = err.sandboxName;
  if (err.text) out.apiResponseText = truncate(redactSecrets(String(err.text)), 2000);
  if (err.json !== undefined) {
    try {
      out.apiResponseJson = JSON.parse(
        truncate(redactSecrets(JSON.stringify(err.json)), 4000)
      );
    } catch {
      out.apiResponseJson = truncate(redactSecrets(String(err.json)), 2000);
    }
  }

  if (err.response) {
    out.httpStatus = err.response.status;
    out.httpStatusText = err.response.statusText;
    if (err.response.url) {
      out.httpUrl = err.response.url.replace(/[?&]token=[^&]+/gi, '?token=[REDACTED]');
    }
  }

  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    out.cause = { name: cause.name, message: cause.message };
  }

  return out;
}

export function buildEditFailureReport(input: EditFailureReportInput): EditFailureReport {
  const timestamp = new Date().toISOString();
  const errorFields = input.error ? serializeThrownError(input.error) : undefined;
  const technical =
    input.technicalMessage ||
    (errorFields?.message as string | undefined) ||
    undefined;

  const context = input.context ?? {};
  const metadata: Record<string, unknown> = {
    timestamp,
    jobId: input.jobId,
    projectId: input.projectId,
    stage: input.stage,
    ownerMessage: input.ownerMessage,
    technicalMessage: technical ?? null,
    context,
    ...(errorFields ? { error: errorFields } : {}),
  };

  const lines: string[] = [
    '=== First Site — Edit failure trace ===',
    `time: ${timestamp}`,
    `jobId: ${input.jobId}`,
    `projectId: ${input.projectId}`,
    `stage: ${input.stage}`,
    '',
    '--- User-facing message ---',
    input.ownerMessage,
  ];

  if (technical) {
    lines.push('', '--- Technical ---', redactSecrets(technical));
  }

  if (errorFields) {
    lines.push('', '--- Error ---');
    lines.push(`name: ${String(errorFields.name ?? 'Error')}`);
    lines.push(`message: ${redactSecrets(String(errorFields.message ?? ''))}`);
    if (errorFields.httpStatus) {
      lines.push(`httpStatus: ${String(errorFields.httpStatus)} ${String(errorFields.httpStatusText ?? '')}`);
    }
    if (errorFields.sandboxSessionId) {
      lines.push(`sandboxSessionId: ${String(errorFields.sandboxSessionId)}`);
    }
    if (errorFields.sandboxName) {
      lines.push(`sandboxName: ${String(errorFields.sandboxName)}`);
    }
    if (errorFields.stack) {
      lines.push('', '--- Stack (first 20 lines) ---', String(errorFields.stack));
    }
    if (errorFields.apiResponseText) {
      lines.push('', '--- API response text ---', String(errorFields.apiResponseText));
    }
    if (errorFields.apiResponseJson) {
      lines.push(
        '',
        '--- API response JSON ---',
        truncate(redactSecrets(JSON.stringify(errorFields.apiResponseJson, null, 2)), 4000)
      );
    }
  }

  const contextEntries = Object.entries(context).filter(([, v]) => v !== undefined && v !== null);
  if (contextEntries.length > 0) {
    lines.push('', '--- Context ---');
    for (const [key, value] of contextEntries) {
      const rendered =
        typeof value === 'string'
          ? redactSecrets(value)
          : truncate(redactSecrets(JSON.stringify(value)), 800);
      lines.push(`${key}: ${rendered}`);
    }
  }

  lines.push('', '=== End trace ===');

  const copyText = lines.join('\n');
  metadata.copyText = copyText;

  return { copyText, metadata };
}
