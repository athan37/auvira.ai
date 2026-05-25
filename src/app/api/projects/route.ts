import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';

export async function GET() {
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  const projects = await WebsiteProject.find({ ownerId: authResult.userId })
    .select('_id name mode sourceUrl siteSpec deployment gitlab status createdAt updatedAt lastEditedAt')
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json({
    ok: true,
    projects: projects.map((p) => ({
      id: (p._id as any).toString(),
      name: p.name,
      mode: p.mode,
      sourceUrl: p.sourceUrl,
      siteTitle: (p.siteSpec as any)?.siteTitle,
      deploymentStatus: p.deployment?.status,
      liveUrl: p.deployment?.liveUrl,
      repoUrl: p.gitlab?.repoUrl,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      lastEditedAt: p.lastEditedAt,
    })),
  });
}