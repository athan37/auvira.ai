import mongoose from 'mongoose';
import { OwnerMonitor, type IOwnerMonitor } from '@/models/OwnerMonitor';
import type { IBusinessProfile } from '@/models/BusinessProfile';
import type { MonitorType } from './types';

const LABELS: Record<MonitorType, string> = {
  uptime: 'Site loads correctly',
  phone: 'Correct phone number',
  hours: 'Business hours',
  service_visibility: 'Main services visible',
  banner_expiry: 'Expired banners removed',
};

export type ProfileForMonitors = Pick<
  IBusinessProfile,
  'phone' | 'hours' | 'mainServices' | 'bannerRules'
>;

export function buildMonitorSuggestions(profile: ProfileForMonitors) {
  const out: Array<{
    type: MonitorType;
    label: string;
    expectedValue: unknown;
    severity: 'critical' | 'warning' | 'opportunity';
  }> = [];

  out.push({ type: 'uptime', label: LABELS.uptime, expectedValue: { url: 'live' }, severity: 'critical' });
  if (profile.phone?.trim()) {
    out.push({ type: 'phone', label: LABELS.phone, expectedValue: profile.phone.trim(), severity: 'critical' });
  }
  if (profile.hours?.trim()) {
    out.push({ type: 'hours', label: LABELS.hours, expectedValue: profile.hours.trim(), severity: 'warning' });
  }
  if (profile.mainServices?.length) {
    out.push({
      type: 'service_visibility',
      label: LABELS.service_visibility,
      expectedValue: profile.mainServices,
      severity: 'warning',
    });
  }
  if (profile.bannerRules?.length) {
    out.push({
      type: 'banner_expiry',
      label: LABELS.banner_expiry,
      expectedValue: profile.bannerRules,
      severity: 'warning',
    });
  }
  return out;
}

export async function suggestMonitorsFromProfile(
  projectId: string,
  ownerId: string,
  profile: IBusinessProfile
): Promise<IOwnerMonitor[]> {
  const monitors: IOwnerMonitor[] = [];
  for (const s of buildMonitorSuggestions(profile)) {
    const defaultEnabled = s.type === 'uptime' || s.type === 'phone';
    const m = await OwnerMonitor.findOneAndUpdate(
      { projectId: new mongoose.Types.ObjectId(projectId), type: s.type },
      {
        $setOnInsert: {
          projectId: new mongoose.Types.ObjectId(projectId),
          ownerId: new mongoose.Types.ObjectId(ownerId),
          type: s.type,
          enabled: defaultEnabled,
        },
        $set: {
          expectedValue: s.expectedValue,
          severity: s.severity,
          autoFixAllowed: false,
          confirmedByOwner: true,
        },
      },
      { upsert: true, new: true }
    );
    monitors.push(m);
  }
  return monitors;
}

export async function listMonitors(projectId: string) {
  return OwnerMonitor.find({ projectId: new mongoose.Types.ObjectId(projectId) }).sort({ type: 1 });
}

export async function setMonitorEnabled(projectId: string, monitorId: string, enabled: boolean) {
  return OwnerMonitor.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(monitorId),
      projectId: new mongoose.Types.ObjectId(projectId),
      confirmedByOwner: true,
    },
    { $set: { enabled } },
    { new: true }
  );
}

export function getMonitorLabel(type: MonitorType) {
  return LABELS[type];
}
