import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { connectMongoDB } from '@/lib/mongodb';
import { WebsiteAnalyticsConfig } from '@/models/WebsiteAnalyticsConfig';
import { recordAnalyticsBatch } from '@/lib/analytics/collect/aggregateAnalyticsEvents';
import {
  originAllowed,
  rejectOversizedAnalyticsBody,
  safeOrigin,
  sanitizeAnalyticsPayload,
  validateAnalyticsPayload,
} from '@/lib/analytics/collect/validateAnalyticsPayload';

export const runtime = 'nodejs';

function corsHeaders(origin: string | null, allowed = true): HeadersInit {
  return {
    'access-control-allow-origin': allowed && origin ? origin : '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');

  if (rejectOversizedAnalyticsBody(request.headers.get('content-length'))) {
    return NextResponse.json(
      { ok: false, error: 'Analytics batch is too large.' },
      { status: 413, headers: corsHeaders(origin) }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON payload.' },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  let payload;
  try {
    payload = validateAnalyticsPayload(rawBody);
  } catch (error) {
    const message =
      error instanceof ZodError
        ? error.issues[0]?.message || 'Invalid analytics payload.'
        : 'Invalid analytics payload.';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  try {
    await connectMongoDB();
    const config = await WebsiteAnalyticsConfig.findOne({
      publicSiteKey: payload.publicSiteKey,
    });

    if (!config) {
      return NextResponse.json(
        { ok: false, error: 'Unknown analytics site key.' },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    if (!config.enabled) {
      return NextResponse.json(
        { ok: false, error: 'Analytics is disabled for this site.' },
        { status: 403, headers: corsHeaders(origin) }
      );
    }

    const requestOrigin = safeOrigin(origin ?? undefined);
    const allowed = originAllowed(requestOrigin ?? null, config.allowedOrigins ?? []);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: 'Origin is not allowed for this analytics site.' },
        { status: 403, headers: corsHeaders(origin, false) }
      );
    }

    const sanitized = sanitizeAnalyticsPayload({
      payload,
      userAgent: request.headers.get('user-agent'),
    });

    const result = await recordAnalyticsBatch({ config, payload: sanitized });
    return NextResponse.json(
      { ok: true, accepted: result.eventCount },
      { headers: corsHeaders(origin) }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Analytics collection failed.' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
