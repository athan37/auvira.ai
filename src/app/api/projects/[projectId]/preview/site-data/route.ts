import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { generatePageHtml } from '@/lib/builder/generatePageHtml';
import { join } from 'path';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

export const runtime = 'nodejs';

/**
 * Returns HTML string for the project preview page.
 * Used by the shared preview runtime's page.tsx to render project content.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
  }

  const spec = project.draftSiteSpec || project.siteSpec;

  try {
    const html = generatePageHtml(
      spec as unknown as import('@/lib/agent/schemas').SiteSpec,
      project.name || 'Preview'
    );

    return NextResponse.json({ ok: true, html });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}