import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { generatePreviewCss } from '@/lib/preview/generatePreviewCss';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
  }

  const spec = project.draftSiteSpec || project.siteSpec;
  if (!spec) {
    return NextResponse.json({ ok: false, error: 'No site spec found' }, { status: 400 });
  }

  try {
    const css = generatePreviewCss(spec as unknown as import('@/lib/agent/schemas').SiteSpec);

    return new NextResponse(css, {
      status: 200,
      headers: {
        'content-type': 'text/css; charset=utf-8',
        'cache-control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}