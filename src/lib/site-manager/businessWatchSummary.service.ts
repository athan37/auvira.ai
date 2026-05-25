import mongoose from 'mongoose';
import { BusinessProfile } from '@/models/BusinessProfile';
import { SiteHealthIncident } from '@/models/SiteHealthIncident';
import { SiteFixProposal } from '@/models/SiteFixProposal';
import { healthyCopy, issueCopy, setupCopy, fixedCopy } from './notifyCopy';
import type { IncidentType } from './types';
import { getMonitorLabel, listMonitors } from './watchRules.service';

export async function getBusinessWatchSummary(projectId: string) {
  const profile = await BusinessProfile.findOne({ projectId: new mongoose.Types.ObjectId(projectId) });

  if (!profile?.confirmedAt) {
    return {
      needsSetup: true,
      profile: profile
        ? {
            businessName: profile.businessName,
            phone: profile.phone,
            hours: profile.hours,
            mainServices: profile.mainServices,
            bannerRules: profile.bannerRules ?? [],
          }
        : null,
      copy: setupCopy(),
    };
  }

  const monitors = await listMonitors(projectId);
  const openIncident = await SiteHealthIncident.findOne({
    projectId: new mongoose.Types.ObjectId(projectId),
    status: { $in: ['open', 'fix_suggested', 'fix_approved', 'fix_applied'] },
  }).sort({ createdAt: -1 });

  const recentResolved = await SiteHealthIncident.findOne({
    projectId: new mongoose.Types.ObjectId(projectId),
    status: 'resolved',
    resolvedAt: { $gte: new Date(Date.now() - 86400000) },
  }).sort({ resolvedAt: -1 });

  let proposal = null;
  if (openIncident?.activeProposalId) {
    proposal = await SiteFixProposal.findById(openIncident.activeProposalId);
  }

  const monitorDto = monitors.map((m) => ({
    id: m._id.toString(),
    type: m.type,
    label: getMonitorLabel(m.type),
    enabled: m.enabled,
    lastResult: m.lastResult ?? null,
    lastCheckedAt: m.lastCheckedAt?.toISOString() ?? null,
  }));

  const profileDto = {
    businessName: profile.businessName,
    phone: profile.phone,
    hours: profile.hours,
    mainServices: profile.mainServices,
    bannerRules: profile.bannerRules ?? [],
    confirmedAt: profile.confirmedAt.toISOString(),
    lastWatchRunAt: profile.lastWatchRunAt?.toISOString() ?? null,
  };

  if (openIncident && proposal) {
    return {
      needsSetup: false,
      profile: profileDto,
      monitors: monitorDto,
      lastWatchRunAt: profile.lastWatchRunAt?.toISOString(),
      incident: {
        id: openIncident._id.toString(),
        type: openIncident.type,
        status: openIncident.status,
        expectedValue: openIncident.expectedValue,
        observedValue: openIncident.observedValue,
      },
      proposal: {
        id: proposal._id.toString(),
        title: proposal.title,
        plainEnglishSummary: proposal.plainEnglishSummary,
      },
      copy: issueCopy(
        openIncident.type as IncidentType,
        String(openIncident.expectedValue ?? ''),
        String(openIncident.observedValue ?? '')
      ),
    };
  }

  if (recentResolved) {
    return {
      needsSetup: false,
      profile: profileDto,
      monitors: monitorDto,
      copy: fixedCopy(recentResolved.type as IncidentType, String(recentResolved.expectedValue ?? '')),
    };
  }

  return {
    needsSetup: false,
    profile: profileDto,
    monitors: monitorDto,
    lastWatchRunAt: profile.lastWatchRunAt?.toISOString(),
    copy: healthyCopy(profile.lastWatchRunAt ?? undefined),
  };
}
