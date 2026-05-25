import { NextRequest, NextResponse } from 'next/server';
import { getLatestDeploymentStatus } from '@/lib/vercel/getLatestDeploymentStatus';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get('projectId') || undefined;
  const projectName = searchParams.get('projectName') || undefined;
  const since = searchParams.get('since') || undefined;
  const deployHookId = searchParams.get('deployHookId') || undefined;

  if (!projectId && !projectName) {
    return NextResponse.json(
      { ok: false, error: 'projectId or projectName is required' },
      { status: 400 }
    );
  }

  try {
    const result = await getLatestDeploymentStatus({
      projectId,
      projectName,
      since,
      deployHookId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: `Failed to get deployment status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}