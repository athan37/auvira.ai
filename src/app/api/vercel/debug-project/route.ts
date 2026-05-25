import { NextRequest, NextResponse } from 'next/server';
import { VercelClient } from '@/lib/vercel/vercelClient';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectName = searchParams.get('projectName');

  if (!projectName) {
    return NextResponse.json(
      { ok: false, error: 'projectName is required' },
      { status: 400 }
    );
  }

  const client = new VercelClient();
  const teamId = client.teamId;

  const result = {
    ok: true,
    teamIdUsed: !!teamId,
    teamIdValue: teamId || null,
    projectFound: false,
    project: null as {
      id: string;
      name: string;
      framework?: string;
      gitRepository: Record<string, unknown>;
    } | null,
    deploymentsFound: 0,
    latestDeployments: [] as Array<{
      id: string;
      state: string;
      url: string;
      inspectorUrl: string;
      createdAt: number;
      readyAt?: number;
    }>,
  };

  try {
    const projectResponse = await client.request<{
      id: string;
      name: string;
      framework?: string;
      gitRepository?: Record<string, unknown>;
    }>(`/v2/projects/${projectName}`, {
      method: 'GET',
    });

    result.projectFound = true;
    result.project = {
      id: projectResponse.id,
      name: projectResponse.name,
      framework: projectResponse.framework,
      gitRepository: projectResponse.gitRepository || {},
    };
  } catch (error) {
    const err = error as { message?: string };
    console.error(`[Vercel Debug] Project lookup failed: ${err.message || 'Unknown error'}`);
  }

  try {
    const deploymentsResponse = await client.request<{
      deployments: Array<{
        uid: string;
        name: string;
        url: string;
        state: string;
        createdAt: number;
        readyAt?: number;
      }>;
    }>(`/v6/deployments?projectName=${encodeURIComponent(projectName)}&limit=10`, {
      method: 'GET',
    });

    const deployments = deploymentsResponse.deployments || [];
    result.deploymentsFound = deployments.length;
    result.latestDeployments = deployments.map((d) => ({
      id: d.uid,
      state: d.state,
      url: d.url ? `https://${d.url}` : '',
      inspectorUrl: `https://vercel.com/dashboard/deployments/${d.uid}`,
      createdAt: d.createdAt,
      readyAt: d.readyAt,
    }));
  } catch (error) {
    const err = error as { message?: string };
    console.error(`[Vercel Debug] Failed to get deployments: ${err.message || 'Unknown error'}`);
  }

  return NextResponse.json(result);
}