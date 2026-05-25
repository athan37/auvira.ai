import mongoose from 'mongoose';
import { SiteHealthIncident, type ISiteHealthIncident } from '@/models/SiteHealthIncident';
import { SiteFixProposal } from '@/models/SiteFixProposal';
import type { IncidentType } from './types';
import type { IOwnerMonitor } from '@/models/OwnerMonitor';

const OPEN = ['open', 'fix_suggested', 'fix_approved', 'fix_applied'];

export async function createIncident(input: {
  projectId: string;
  ownerId: string;
  monitor: IOwnerMonitor;
  type: IncidentType;
  expectedValue: unknown;
  observedValue?: unknown;
  evidence?: Record<string, unknown>;
}) {
  const existing = await SiteHealthIncident.findOne({
    projectId: new mongoose.Types.ObjectId(input.projectId),
    monitorId: input.monitor._id,
    status: { $in: OPEN },
  });
  if (existing) {
    existing.observedValue = input.observedValue;
    existing.evidence = input.evidence;
    if (existing.status === 'open') existing.status = 'fix_suggested';
    await existing.save();
    return existing;
  }
  return SiteHealthIncident.create({
    projectId: new mongoose.Types.ObjectId(input.projectId),
    ownerId: new mongoose.Types.ObjectId(input.ownerId),
    monitorId: input.monitor._id,
    type: input.type,
    severity: input.monitor.severity,
    status: 'open',
    expectedValue: input.expectedValue,
    observedValue: input.observedValue,
    evidence: input.evidence,
    fixAttempts: 0,
  });
}

export async function listIncidents(projectId: string) {
  return SiteHealthIncident.find({
    projectId: new mongoose.Types.ObjectId(projectId),
    status: { $in: [...OPEN, 'resolved', 'dismissed', 'failed'] },
  })
    .sort({ createdAt: -1 })
    .limit(20);
}

export async function getIncident(projectId: string, incidentId: string) {
  return SiteHealthIncident.findOne({
    _id: new mongoose.Types.ObjectId(incidentId),
    projectId: new mongoose.Types.ObjectId(projectId),
  });
}

export async function dismissIncident(projectId: string, incidentId: string) {
  const incident = await getIncident(projectId, incidentId);
  if (!incident) return null;
  incident.status = 'dismissed';
  incident.resolvedAt = new Date();
  await incident.save();
  await SiteFixProposal.updateMany(
    { incidentId: incident._id, status: 'pending' },
    { $set: { status: 'rejected' } }
  );
  return incident;
}

export async function markIncidentResolved(incident: ISiteHealthIncident) {
  incident.status = 'resolved';
  incident.resolvedAt = new Date();
  await incident.save();
}

export async function markIncidentFailed(incident: ISiteHealthIncident) {
  incident.status = 'failed';
  await incident.save();
}
