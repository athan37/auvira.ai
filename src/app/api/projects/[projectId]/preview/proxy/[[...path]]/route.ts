import { NextRequest } from 'next/server';
import { handlePreviewProxyGet } from '@/lib/project-workspace/previewProxyHandler';

export const runtime = 'nodejs';

/**
 * Catch-all proxy to the project's local Next.js dev server.
 * Handles HTML, /_next/static/*, chunks, and other assets.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; path?: string[] } }
) {
  return handlePreviewProxyGet(request, params.projectId, params.path);
}
