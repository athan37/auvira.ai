import crypto from 'crypto';
import { z } from 'zod';
import {
  MAX_ANALYTICS_BODY_BYTES,
  MAX_ANALYTICS_EVENTS_PER_BATCH,
} from '@/lib/analytics/generated-sites/analyticsConstants';

const eventSchema = z.object({
  type: z.enum(['view', 'focus', 'click']),
  componentId: z.string().min(1).max(160),
  componentType: z.enum(['hero', 'section', 'cta']),
  componentLabel: z.string().max(240).optional(),
  durationMs: z.number().int().min(0).max(30 * 60 * 1000).optional(),
  visibleRatio: z.number().min(0).max(1).optional(),
  occurredAt: z.string().datetime().optional(),
});

const payloadSchema = z.object({
  publicSiteKey: z.string().min(8).max(128),
  visitorId: z.string().max(256).optional(),
  sessionId: z.string().max(256).optional(),
  pageUrl: z.string().max(2048).optional(),
  referrer: z.string().max(2048).optional(),
  events: z.array(eventSchema).min(1).max(MAX_ANALYTICS_EVENTS_PER_BATCH),
});

export type ValidatedAnalyticsPayload = z.infer<typeof payloadSchema>;

export interface SanitizedAnalyticsPayload {
  publicSiteKey: string;
  visitorIdHash?: string;
  sessionIdHash?: string;
  userAgentHash?: string;
  pagePath?: string;
  pageOrigin?: string;
  referrerOrigin?: string;
  events: Array<{
    type: 'view' | 'focus' | 'click';
    componentId: string;
    componentType: 'hero' | 'section' | 'cta';
    componentLabel?: string;
    durationMs?: number;
    visibleRatio?: number;
    occurredAt: Date;
  }>;
}

export function rejectOversizedAnalyticsBody(contentLength: string | null): boolean {
  if (!contentLength) return false;
  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes > MAX_ANALYTICS_BODY_BYTES;
}

function hashValue(value: string | undefined, salt: string): string | undefined {
  if (!value?.trim()) return undefined;
  return crypto
    .createHash('sha256')
    .update(`${salt}:${value}`)
    .digest('hex');
}

export function safeOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

export function safePathWithoutQuery(value: string | undefined): {
  pagePath?: string;
  pageOrigin?: string;
} {
  if (!value) return {};
  try {
    const url = new URL(value);
    return {
      pagePath: url.pathname || '/',
      pageOrigin: url.origin,
    };
  } catch {
    if (value.startsWith('/')) {
      return { pagePath: value.split('?')[0] || '/' };
    }
    return {};
  }
}

export function originAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (allowedOrigins.length === 0) return true;
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

export function validateAnalyticsPayload(input: unknown): ValidatedAnalyticsPayload {
  return payloadSchema.parse(input);
}

export function sanitizeAnalyticsPayload(input: {
  payload: ValidatedAnalyticsPayload;
  userAgent?: string | null;
}): SanitizedAnalyticsPayload {
  const { pagePath, pageOrigin } = safePathWithoutQuery(input.payload.pageUrl);
  const salt = input.payload.publicSiteKey;

  return {
    publicSiteKey: input.payload.publicSiteKey,
    visitorIdHash: hashValue(input.payload.visitorId, salt),
    sessionIdHash: hashValue(input.payload.sessionId, salt),
    userAgentHash: hashValue(input.userAgent ?? undefined, salt),
    pagePath,
    pageOrigin,
    referrerOrigin: safeOrigin(input.payload.referrer),
    events: input.payload.events.map((event) => ({
      type: event.type,
      componentId: event.componentId,
      componentType: event.componentType,
      componentLabel: event.componentLabel,
      durationMs: event.durationMs,
      visibleRatio: event.visibleRatio,
      occurredAt: event.occurredAt ? new Date(event.occurredAt) : new Date(),
    })),
  };
}
