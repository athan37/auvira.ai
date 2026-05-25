import mongoose from 'mongoose';
import { SiteFixProposal, type ISiteFixProposal } from '@/models/SiteFixProposal';
import type { ISiteHealthIncident } from '@/models/SiteHealthIncident';
import type { IncidentType } from './types';
import {
  buildRedeployOnlyChange,
  buildRemoveExpiredBannerChange,
  buildRestoreHoursChange,
  buildRestoreMainServiceChange,
  buildRestorePhoneChange,
} from './patchers';

export function buildFixProposalForIncident(incident: ISiteHealthIncident) {
  const type = incident.type as IncidentType;
  const expected = incident.expectedValue;
  switch (type) {
    case 'phone_mismatch': {
      const phone = String(expected ?? '');
      return {
        title: 'Restore your phone number',
        plainEnglishSummary: `We will put ${phone} back on your live website and republish.`,
        proposedChange: buildRestorePhoneChange(phone),
      };
    }
    case 'hours_mismatch': {
      const hours = String(expected ?? '');
      return {
        title: 'Restore your business hours',
        plainEnglishSummary: `We will update your business hours and republish.`,
        proposedChange: buildRestoreHoursChange(hours),
      };
    }
    case 'missing_service': {
      const services = Array.isArray(expected) ? expected : [String(expected)];
      const service = String(services[0] ?? '');
      return {
        title: 'Restore your main service',
        plainEnglishSummary: `We will make sure "${service}" appears on your live website.`,
        proposedChange: buildRestoreMainServiceChange(service),
      };
    }
    case 'expired_banner':
      return {
        title: 'Remove expired notice',
        plainEnglishSummary: `We will remove the expired notice from your live website.`,
        proposedChange: buildRemoveExpiredBannerChange(String(incident.observedValue ?? '')),
      };
    case 'site_down':
      return {
        title: 'Republish your live website',
        plainEnglishSummary: 'We will republish your backup copy to restore your live website.',
        proposedChange: buildRedeployOnlyChange(),
      };
    default:
      return null;
  }
}

export async function createFixProposal(projectId: string, incident: ISiteHealthIncident) {
  const existing = await SiteFixProposal.findOne({ incidentId: incident._id, status: 'pending' });
  if (existing) return existing;

  const built = buildFixProposalForIncident(incident);
  if (!built) return null;

  const proposal = await SiteFixProposal.create({
    projectId: new mongoose.Types.ObjectId(projectId),
    incidentId: incident._id,
    title: built.title,
    plainEnglishSummary: built.plainEnglishSummary,
    proposedChange: built.proposedChange,
    riskLevel: 'safe',
    requiresApproval: true,
    status: 'pending',
  });

  incident.status = 'fix_suggested';
  incident.activeProposalId = proposal._id;
  await incident.save();
  return proposal;
}

export async function getFixProposal(projectId: string, proposalId: string) {
  return SiteFixProposal.findOne({
    _id: new mongoose.Types.ObjectId(proposalId),
    projectId: new mongoose.Types.ObjectId(projectId),
  });
}

export async function approveFixProposal(proposal: ISiteFixProposal) {
  proposal.status = 'approved';
  await proposal.save();
  return proposal;
}
