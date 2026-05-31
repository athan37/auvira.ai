import { NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import {
  buildSectionBridgeScriptBody,
  PREVIEW_SECTION_BRIDGE_VERSION,
} from '@/lib/preview/sectionBridgeScript';

export const runtime = 'nodejs';

/** Serve the preview section bridge script (external file avoids inline-script CSP blocks). */
export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } }
): Promise<NextResponse> {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
  }

  return new NextResponse(buildSectionBridgeScriptBody(), {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Section-Bridge-Version': String(PREVIEW_SECTION_BRIDGE_VERSION),
    },
  });
}
