import { NextRequest, NextResponse } from 'next/server';
import { getOwnerProject } from '@/lib/api/projectAccess';
import { WebsiteProject } from '@/models/WebsiteProject';

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const project = await getOwnerProject(params.projectId);
  if (!project) {
    return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
  }

  const preview = project.preview;
  if (!preview || preview.status === 'not_started') {
    return NextResponse.json({ ok: false, error: 'No preview server for this project' }, { status: 404 });
  }

  if (preview.status === 'ready' || preview.status === 'failed' || preview.status === 'stopped') {
    return NextResponse.json({
      ok: true,
      status: preview.status,
      url: preview.url || null,
      port: preview.port || null,
    });
  }

  // For 'building' or 'starting', try to reach the server
  if (preview.url || preview.port) {
    const url = preview.url || `http://localhost:${preview.port}`;
    try {
      const http = require('http');
      const result = await new Promise<{ ok: boolean; statusCode?: number }>((resolve, reject) => {
        const req = http.get(url, (res: any) => {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, statusCode: res.statusCode });
        });
        req.on('error', reject);
        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });

      if (result.ok) {
        await WebsiteProject.updateOne({ _id: project._id }, {
          $set: { 'preview.status': 'ready', 'preview.url': url },
        });
        return NextResponse.json({
          ok: true,
          status: 'ready',
          url,
          port: preview.port || null,
        });
      } else {
        return NextResponse.json({
          ok: true,
          status: preview.status,
          url,
          port: preview.port || null,
          note: `Server responded with HTTP ${result.statusCode}`,
        });
      }
    } catch {
      return NextResponse.json({
        ok: true,
        status: preview.status,
        url,
        port: preview.port || null,
        reachable: false,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    status: preview.status,
    port: preview.port || null,
  });
}