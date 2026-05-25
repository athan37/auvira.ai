import mongoose from 'mongoose';
import { BusinessProfile } from '@/models/BusinessProfile';
import { OwnerMonitor } from '@/models/OwnerMonitor';
import { ProjectAction } from '@/models/ProjectAction';
import { WebsiteProject } from '@/models/WebsiteProject';
import { resolveProductionLiveUrl } from '@/lib/vercel/resolveProductionLiveUrl';
import { runBannerExpiryCheck } from './checks/bannerExpiryCheck';
import { runHoursCheck } from './checks/hoursCheck';
import { runPhoneCheck } from './checks/phoneCheck';
import { runServiceVisibilityCheck } from './checks/serviceVisibilityCheck';
import { runUptimeCheck } from './checks/uptimeCheck';
import { createFixProposal } from './fixProposal.service';
import { createIncident } from './incidents.service';
import { fetchLiveSite } from './fetchLiveSite';
import type { BannerRule, CheckResult, MonitorType, WatchCheckContext } from './types';
import { MONITOR_TO_INCIDENT } from './types';

function runCheck(type: MonitorType, ctx: WatchCheckContext, expected: unknown): CheckResult {
  switch (type) {
    case 'uptime':
      return runUptimeCheck(ctx, 'live');
    case 'phone':
      return runPhoneCheck(ctx, String(expected));
    case 'hours':
      return runHoursCheck(ctx, String(expected));
    case 'service_visibility':
      return runServiceVisibilityCheck(ctx, Array.isArray(expected) ? (expected as string[]) : []);
    case 'banner_expiry':
      return runBannerExpiryCheck(ctx, (expected as BannerRule[]) ?? []);
    default:
      return { passed: true };
  }
}

export async function resolveLiveUrl(project: {
  deployment?: {
    liveUrl?: string | null;
    expectedProductionUrl?: string | null;
    deploymentUrl?: string | null;
    status?: string;
  };
}): Promise<string | null> {
  const dep = project.deployment;
  if (!dep) return null;
  return (
    dep.liveUrl ||
    resolveProductionLiveUrl(dep.status === 'ready' ? 'ready' : 'building', {
      deploymentUrl: dep.deploymentUrl,
      expectedProductionUrl: dep.expectedProductionUrl,
    })
  );
}

export async function runWatchChecks(projectId: string, options?: { monitorTypes?: MonitorType[] }) {
  const project = await WebsiteProject.findById(projectId);
  if (!project) throw new Error('Project not found');

  const profile = await BusinessProfile.findOne({ projectId: new mongoose.Types.ObjectId(projectId) });
  if (!profile?.confirmedAt) throw new Error('Confirm your business details first');

  const liveUrl = await resolveLiveUrl(project);
  if (!liveUrl) throw new Error('Publish your site first — no live URL yet');

  const filter: Record<string, unknown> = {
    projectId: new mongoose.Types.ObjectId(projectId),
    enabled: true,
    confirmedByOwner: true,
  };
  if (options?.monitorTypes?.length) filter.type = { $in: options.monitorTypes };

  const monitors = await OwnerMonitor.find(filter);
  const fetch = await fetchLiveSite(liveUrl);
  const ctx: WatchCheckContext = { liveUrl, html: fetch.html, httpStatus: fetch.status };
  const now = new Date();
  let passed = 0;
  let failed = 0;
  let incidentsCreated = 0;

  for (const monitor of monitors) {
    const result = runCheck(monitor.type, ctx, monitor.expectedValue);
    monitor.lastCheckedAt = now;
    monitor.lastResult = result.passed ? 'pass' : 'fail';
    await monitor.save();

    if (result.passed) {
      passed++;
    } else {
      failed++;
      const incident = await createIncident({
        projectId,
        ownerId: project.ownerId.toString(),
        monitor,
        type: MONITOR_TO_INCIDENT[monitor.type as MonitorType],
        expectedValue: monitor.expectedValue,
        observedValue: result.observedValue,
        evidence: result.evidence,
      });
      await createFixProposal(projectId, incident);
      incidentsCreated++;
      try {
        await ProjectAction.create({
          projectId: new mongoose.Types.ObjectId(projectId),
          ownerId: project.ownerId,
          type: 'watch_failed',
          status: 'succeeded',
          input: { monitorType: monitor.type },
          completedAt: now,
        });
      } catch {
        /* optional */
      }
    }
  }

  profile.lastWatchRunAt = now;
  await profile.save();

  return { ok: failed === 0, checksRun: monitors.length, passed, failed, incidentsCreated, lastCheckedAt: now };
}

export async function rerunMonitorCheck(projectId: string, monitorId: string): Promise<CheckResult> {
  const project = await WebsiteProject.findById(projectId);
  const monitor = await OwnerMonitor.findOne({
    _id: new mongoose.Types.ObjectId(monitorId),
    projectId: new mongoose.Types.ObjectId(projectId),
  });
  if (!project || !monitor) throw new Error('Monitor not found');

  const liveUrl = await resolveLiveUrl(project);
  if (!liveUrl) throw new Error('No live URL');

  const fetch = await fetchLiveSite(liveUrl);
  const ctx: WatchCheckContext = { liveUrl, html: fetch.html, httpStatus: fetch.status };
  const result = runCheck(monitor.type, ctx, monitor.expectedValue);
  monitor.lastCheckedAt = new Date();
  monitor.lastResult = result.passed ? 'pass' : 'fail';
  await monitor.save();
  return result;
}
