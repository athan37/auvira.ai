import { describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { recordAnalyticsBatch } from '@/lib/analytics/collect/aggregateAnalyticsEvents';
import {
  rejectOversizedAnalyticsBody,
  sanitizeAnalyticsPayload,
  validateAnalyticsPayload,
} from '@/lib/analytics/collect/validateAnalyticsPayload';
import {
  MAX_ANALYTICS_BODY_BYTES,
  MAX_ANALYTICS_EVENTS_PER_BATCH,
} from '@/lib/analytics/generated-sites/analyticsConstants';

class FakeAggregateModel {
  docs = new Map<string, Record<string, any>>();

  private key(filter: Record<string, unknown>) {
    return JSON.stringify(filter, (_key, value) =>
      value instanceof Date ? value.toISOString() : value
    );
  }

  findOneAndUpdate(filter: Record<string, unknown>, update: Record<string, any>) {
    const key = this.key(filter);
    const doc = this.docs.get(key) ?? {
      ...filter,
      ...(update.$setOnInsert ?? {}),
      impressions: 0,
      focusMs: 0,
      clicks: 0,
      uniqueSessions: 0,
      sessionHashes: [],
    };

    Object.assign(doc, update.$set ?? {});
    for (const [field, value] of Object.entries(update.$inc ?? {})) {
      doc[field] = (doc[field] ?? 0) + value;
    }
    const sessionHash = update.$addToSet?.sessionHashes;
    if (sessionHash && !doc.sessionHashes.includes(sessionHash)) {
      doc.sessionHashes.push(sessionHash);
    }
    this.docs.set(key, doc);
    return { select: async () => doc };
  }

  async updateOne(filter: Record<string, unknown>, update: Record<string, any>) {
    const doc = this.docs.get(this.key(filter));
    if (doc) Object.assign(doc, update.$set ?? {});
  }
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    publicSiteKey: 'was_public_test_key',
    visitorId: 'visitor-raw',
    sessionId: 'session-raw',
    pageUrl: 'https://customer.example/services?utm_source=newsletter',
    referrer: 'https://google.com/search?q=secret',
    events: [
      {
        type: 'view',
        componentId: 'section_services',
        componentType: 'section',
        componentLabel: 'Services',
        occurredAt: '2026-05-25T12:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

describe('analytics collect validation and aggregation', () => {
  it('rejects invalid payloads and oversized batches', () => {
    expect(() => validateAnalyticsPayload({ publicSiteKey: 'short', events: [] })).toThrow();
    expect(() =>
      validateAnalyticsPayload(
        validPayload({
          events: Array.from({ length: MAX_ANALYTICS_EVENTS_PER_BATCH + 1 }, () => ({
            type: 'view',
            componentId: 'section',
            componentType: 'section',
          })),
        })
      )
    ).toThrow();
    expect(rejectOversizedAnalyticsBody(String(MAX_ANALYTICS_BODY_BYTES + 1))).toBe(true);
  });

  it('sanitizes URL, referrer, visitor, session, and user agent values', () => {
    const sanitized = sanitizeAnalyticsPayload({
      payload: validateAnalyticsPayload(validPayload()),
      userAgent: 'Full Browser User Agent',
    });

    expect(sanitized.pagePath).toBe('/services');
    expect(sanitized.pageOrigin).toBe('https://customer.example');
    expect(sanitized.referrerOrigin).toBe('https://google.com');
    expect(sanitized.visitorIdHash).not.toContain('visitor-raw');
    expect(sanitized.sessionIdHash).not.toContain('session-raw');
    expect(sanitized.userAgentHash).not.toContain('Full Browser User Agent');
  });

  it('aggregates section views and CTA clicks weekly and in total', async () => {
    const eventBatch = { create: vi.fn(async () => undefined) };
    const weekly = new FakeAggregateModel();
    const total = new FakeAggregateModel();
    const config = {
      projectId: new mongoose.Types.ObjectId(),
      ownerId: new mongoose.Types.ObjectId(),
      publicSiteKey: 'was_public_test_key',
    } as any;
    const payload = sanitizeAnalyticsPayload({
      payload: validateAnalyticsPayload(
        validPayload({
          events: [
            {
              type: 'view',
              componentId: 'section_services',
              componentType: 'section',
              componentLabel: 'Services',
              occurredAt: '2026-05-25T12:00:00.000Z',
            },
            {
              type: 'click',
              componentId: 'cta_hero_primary',
              componentType: 'cta',
              componentLabel: 'Call Now',
              occurredAt: '2026-05-25T12:01:00.000Z',
            },
          ],
        })
      ),
      userAgent: 'Browser UA',
    });

    await recordAnalyticsBatch({
      config,
      payload,
      models: { eventBatch, weekly, total },
    });

    const weeklyDocs = [...weekly.docs.values()];
    const totalDocs = [...total.docs.values()];
    expect(eventBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        pagePath: '/services',
        referrerOrigin: 'https://google.com',
        userAgentHash: expect.any(String),
      })
    );
    expect(JSON.stringify((eventBatch.create as any).mock.calls[0][0])).not.toContain('Browser UA');
    expect(JSON.stringify((eventBatch.create as any).mock.calls[0][0])).not.toContain('utm_source');
    expect(weeklyDocs.find((doc) => doc.componentId === 'section_services')?.impressions).toBe(1);
    expect(totalDocs.find((doc) => doc.componentId === 'cta_hero_primary')?.clicks).toBe(1);
  });
});

describe('POST /api/analytics/collect', () => {
  async function loadRoute(mocks: {
    config?: Record<string, unknown> | null;
    recordAnalyticsBatch?: ReturnType<typeof vi.fn>;
  } = {}) {
    vi.resetModules();
    const recordAnalyticsBatchMock = mocks.recordAnalyticsBatch ?? vi.fn(async () => ({ eventCount: 1 }));
    vi.doMock('@/lib/mongodb', () => ({ connectMongoDB: vi.fn(async () => undefined) }));
    vi.doMock('@/models/WebsiteAnalyticsConfig', () => ({
      WebsiteAnalyticsConfig: {
        findOne: vi.fn(async () =>
          mocks.config === undefined
            ? {
                publicSiteKey: 'was_public_test_key',
                enabled: true,
                allowedOrigins: ['https://customer.example'],
                projectId: new mongoose.Types.ObjectId(),
                ownerId: new mongoose.Types.ObjectId(),
              }
            : mocks.config
        ),
      },
    }));
    vi.doMock('@/lib/analytics/collect/aggregateAnalyticsEvents', () => ({
      recordAnalyticsBatch: recordAnalyticsBatchMock,
    }));
    const route = await import('@/app/api/analytics/collect/route');
    return { POST: route.POST, recordAnalyticsBatchMock };
  }

  it('rejects invalid route payloads', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new Request('https://app.example/api/analytics/collect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ publicSiteKey: 'bad', events: [] }),
      }) as any
    );
    expect(response.status).toBe(400);
  });

  it('rejects oversized route batches by content length', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new Request('https://app.example/api/analytics/collect', {
        method: 'POST',
        headers: { 'content-length': String(MAX_ANALYTICS_BODY_BYTES + 1) },
        body: JSON.stringify(validPayload()),
      }) as any
    );
    expect(response.status).toBe(413);
  });

  it('rejects unknown, disabled, and disallowed site keys', async () => {
    const unknown = await loadRoute({ config: null });
    expect(
      (
        await unknown.POST(
          new Request('https://app.example/api/analytics/collect', {
            method: 'POST',
            body: JSON.stringify(validPayload()),
          }) as any
        )
      ).status
    ).toBe(404);

    const disabled = await loadRoute({ config: { enabled: false, allowedOrigins: [] } });
    expect(
      (
        await disabled.POST(
          new Request('https://app.example/api/analytics/collect', {
            method: 'POST',
            body: JSON.stringify(validPayload()),
          }) as any
        )
      ).status
    ).toBe(403);

    const disallowed = await loadRoute({
      config: { enabled: true, allowedOrigins: ['https://allowed.example'] },
    });
    expect(
      (
        await disallowed.POST(
          new Request('https://app.example/api/analytics/collect', {
            method: 'POST',
            headers: { origin: 'https://customer.example' },
            body: JSON.stringify(validPayload()),
          }) as any
        )
      ).status
    ).toBe(403);
  });

  it('accepts valid route payloads with sanitized data', async () => {
    const { POST, recordAnalyticsBatchMock } = await loadRoute();
    const response = await POST(
      new Request('https://app.example/api/analytics/collect', {
        method: 'POST',
        headers: {
          origin: 'https://customer.example',
          'user-agent': 'Do Not Store Raw UA',
        },
        body: JSON.stringify(validPayload()),
      }) as any
    );

    expect(response.status).toBe(200);
    expect(recordAnalyticsBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          pagePath: '/services',
          referrerOrigin: 'https://google.com',
          userAgentHash: expect.any(String),
        }),
      })
    );
    expect(JSON.stringify((recordAnalyticsBatchMock as any).mock.calls[0][0])).not.toContain('Do Not Store Raw UA');
    expect(JSON.stringify((recordAnalyticsBatchMock as any).mock.calls[0][0])).not.toContain('q=secret');
  });
});
