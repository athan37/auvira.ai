import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { generatePageHtml } from '@/lib/preview/generatePageHtml';
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
    // Generate a version hash based on the spec so browser caches properly
    const specStr = JSON.stringify(spec);
    let hash = 0;
    for (let i = 0; i < specStr.length; i++) {
      hash = ((hash << 5) - hash) + specStr.charCodeAt(i);
      hash = hash & hash;
    }
    const version = Math.abs(hash).toString(36);

    const html = generatePageHtml(
      spec as unknown as import('@/lib/agent/schemas').SiteSpec,
      project.name || 'Preview',
      version
    );

    // Inject projectId into the stylesheet URL
    const htmlWithProjectId = html.replace('{{projectId}}', params.projectId);

    return new NextResponse(htmlWithProjectId, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}