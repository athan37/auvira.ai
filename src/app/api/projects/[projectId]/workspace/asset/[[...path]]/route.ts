import { NextRequest, NextResponse } from 'next/server';
import { readWorkspaceAsset } from '@/lib/project-workspace/serveWorkspaceAsset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Serve owner-uploaded images from workspace disk or Vercel Sandbox VM.
 * Used for chat attachment thumbnails (preview/proxy requires local next dev port).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string; path?: string[] } }
) {
  const segments = params.path ?? [];
  const asset = await readWorkspaceAsset(params.projectId, segments);
  if (!asset) {
    return NextResponse.json({ ok: false, error: 'Asset not found' }, { status: 404 });
  }

  return new NextResponse(asset.buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': asset.contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
