import { IWebsiteProjectLog, WebsiteProjectLog } from '@/models/WebsiteProjectLog';
import * as crypto from 'crypto';
import mongoose, { Types } from 'mongoose';

const SECRETS_PATTERNS = [
  /api[_-]?key/i,
  /token/i,
  /secret/i,
  /password/i,
  /authorization/i,
  /auth/i,
  /bearer/i,
  /gitlab/i,
  /vercel/i,
  /minimax/i,
  /openai/i,
  /\.env/i,
  /private[_-]?key/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
];

function isSecretKey(key: string): boolean {
  return SECRETS_PATTERNS.some(pattern => pattern.test(key));
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string' && value.length > 0) {
    // Check if it looks like a secret (API key format)
    if (value.length > 10 && (value.includes('-') || value.includes('_') || value.startsWith('ghp_') || value.startsWith('vcp_') || value.startsWith('glpat-'))) {
      return '[REDACTED]';
    }
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    return redactSecrets(value as Record<string, unknown>);
  }
  return value;
}

export function redactSecrets<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const redacted = { ...obj };

  for (const [key, value] of Object.entries(redacted)) {
    if (isSecretKey(key)) {
      (redacted as Record<string, unknown>)[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        (redacted as Record<string, unknown>)[key] = redactSecrets(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        (redacted as Record<string, unknown>)[key] = value.map(item =>
          typeof item === 'object' && item !== null ? redactSecrets(item as Record<string, unknown>) : item
        );
      }
  }

  return redacted;
}

export function safeError(error: unknown): { message: string; stack?: string; code?: string; cause?: unknown } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      code: (error as any).code,
      cause: error.cause ? redactSecrets(error.cause as Record<string, unknown>) : undefined,
    };
  }
  return { message: String(error) };
}

export async function logProjectStep({
  projectId,
  userId,
  runId,
  operation,
  step,
  status,
  level = 'info',
  message,
  metadata,
  error,
  durationMs,
}: {
  projectId: string;
  userId: string;
  runId: string;
  operation: IWebsiteProjectLog['operation'];
  step: string;
  status: IWebsiteProjectLog['status'];
  level?: IWebsiteProjectLog['level'];
  message: string;
  metadata?: Record<string, unknown>;
  error?: ReturnType<typeof safeError>;
  durationMs?: number;
}): Promise<void> {
  try {
    await WebsiteProjectLog.create({
      projectId: new mongoose.Types.ObjectId(projectId),
      userId: new mongoose.Types.ObjectId(userId),
      runId,
      operation,
      step,
      status,
      level,
      message,
      metadata: metadata ? redactSecrets(metadata) : undefined,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: error.code,
        cause: error.cause ? redactSecrets(error.cause as Record<string, unknown>) : undefined,
      } : undefined,
      durationMs,
    });
  } catch (err) {
    // Never let logging failures crash the operation
    console.error('[projectLogger] Failed to log step:', err instanceof Error ? err.message : err);
  }
}

export function createProjectRun({
  projectId,
  userId,
  operation,
}: {
  projectId: string;
  userId: string;
  operation: IWebsiteProjectLog['operation'];
}): string {
  const runId = crypto.randomUUID();

  // Fire and forget - don't await
  logProjectStep({
    projectId,
    userId,
    runId,
    operation,
    step: `${operation}_started`,
    status: 'started',
    level: 'info',
    message: `${operation} operation started`,
  }).catch(() => {});

  return runId;
}

export async function withProjectStep<T>({
  projectId,
  userId,
  runId,
  operation,
  step,
  message,
  metadata,
  fn,
}: {
  projectId: string;
  userId: string;
  runId: string;
  operation: IWebsiteProjectLog['operation'];
  step: string;
  message: string;
  metadata?: Record<string, unknown>;
  fn: () => Promise<T>;
}): Promise<T> {
  const startTime = Date.now();

  // Log started
  await logProjectStep({
    projectId,
    userId,
    runId,
    operation,
    step: `${step}_started`,
    status: 'started',
    level: 'info',
    message: `${message}...`,
    metadata,
  });

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;

    // Log success
    await logProjectStep({
      projectId,
      userId,
      runId,
      operation,
      step: `${step}_completed`,
      status: 'success',
      level: 'info',
      message: `${message} completed`,
      metadata,
      durationMs,
    });

    return result;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const error = safeError(err);

    // Log failed
    await logProjectStep({
      projectId,
      userId,
      runId,
      operation,
      step: `${step}_failed`,
      status: 'failed',
      level: 'error',
      message: `${message} failed: ${error.message}`,
      metadata,
      error,
      durationMs,
    });

    throw err;
  }
}