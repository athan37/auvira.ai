import { NextRequest, NextResponse } from 'next/server';
import { createVercelProject } from '@/lib/vercel/createVercelProject';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, gitlabProjectId, gitlabRepoUrl, gitlabPathWithNamespace } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (!gitlabRepoUrl) {
      return NextResponse.json({ error: 'gitlabRepoUrl is required' }, { status: 400 });
    }

    const result = await createVercelProject({
      name,
      gitlabProjectId,
      gitlabRepoUrl,
      gitlabPathWithNamespace,
    });

    return NextResponse.json({
      ok: true,
      vercel: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: message,
      note: 'Vercel import failed. Use manual import: copy the GitLab repo URL and paste into Vercel.',
    }, { status: 500 });
  }
}