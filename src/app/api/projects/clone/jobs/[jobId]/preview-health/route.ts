import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/projectAccess';
import { CloneJob } from '@/lib/db/models/CloneJob';
import mongoose from 'mongoose';

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  const { userId } = authResult;

  const job = await CloneJob.findOne({
    _id: new mongoose.Types.ObjectId(params.jobId),
    ownerId: new mongoose.Types.ObjectId(userId),
  });

  if (!job) {
    return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });
  }

  const preview = job.preview;
  if (!preview || preview.status === 'not_started') {
    return NextResponse.json({ ok: false, error: 'No preview server for this job' }, { status: 404 });
  }

  // If already in a final state, just return current status
  if (preview.status === 'ready' || preview.status === 'failed' || preview.status === 'stopped') {
    return NextResponse.json({
      ok: true,
      status: preview.status,
      url: preview.url || null,
      port: preview.port || null,
    });
  }

  // For 'building' or 'starting' status, try to reach the server
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
        // Server is responding — update job status to ready
        await CloneJob.updateOne({ _id: job._id }, {
          $set: {
            'preview.status': 'ready',
            'preview.url': url,
          },
        });
        return NextResponse.json({
          ok: true,
          status: 'ready',
          url,
          port: preview.port || null,
        });
      } else {
        // Server responds but non-2xx — still starting up
        return NextResponse.json({
          ok: true,
          status: preview.status,
          url,
          port: preview.port || null,
          note: `Server responded with HTTP ${result.statusCode}`,
        });
      }
    } catch {
      // Server not reachable yet
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