import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { BusinessProfile } from '@/models/BusinessProfile';
import { OwnerMonitor } from '@/models/OwnerMonitor';
import { runWatchChecks } from '@/lib/site-manager/watchRunner.service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const profiles = await BusinessProfile.find({ confirmedAt: { $ne: null } });
  const results: Array<{ projectId: string; ok: boolean; error?: string }> = [];

  for (const profile of profiles) {
    const projectId = profile.projectId.toString();
    const enabled = await OwnerMonitor.countDocuments({
      projectId: new mongoose.Types.ObjectId(projectId),
      enabled: true,
    });
    if (!enabled) continue;
    try {
      await runWatchChecks(projectId);
      results.push({ projectId, ok: true });
    } catch (err) {
      results.push({
        projectId,
        ok: false,
        error: err instanceof Error ? err.message : 'Failed',
      });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
