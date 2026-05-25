import { NextRequest, NextResponse } from 'next/server';
import { getServerUserId } from '@/lib/api/projectAccess';

export const runtime = 'nodejs';

const AGENT_URL = process.env.ADK_CODING_AGENT_URL || 'http://localhost:8001';

export async function POST(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  // Only allow when explicitly enabled
  const enabled = process.env.DEV_CODING_AGENT_ENABLED === 'true';
  if (!enabled) {
    return NextResponse.json(
      { detail: 'Coding agent is disabled. Set DEV_CODING_AGENT_ENABLED=true to enable.' },
      { status: 403 }
    );
  }

  // Basic auth check - developer-only
  const userId = await getServerUserId();
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { task } = body;

  if (!task || typeof task !== 'string') {
    return NextResponse.json({ detail: 'task is required' }, { status: 400 });
  }

  const action = params.action || 'run';

  try {
    const response = await fetch(`${AGENT_URL}/agent/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task }),
      // Increase timeout for long-running agent tasks
      signal: AbortSignal.timeout(300000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { detail: `Agent error: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    // For SSE streaming, passthrough directly
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader();
          if (!reader) { controller.close(); return; }
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } catch { /* interrupted */ }
          finally { controller.close(); }
        }
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // Non-streaming
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { detail: `Failed to reach coding agent: ${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 502 }
    );
  }
}