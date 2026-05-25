export type MonitorType =
  | 'uptime'
  | 'phone'
  | 'hours'
  | 'service_visibility'
  | 'banner_expiry';

export type IncidentType =
  | 'site_down'
  | 'phone_mismatch'
  | 'hours_mismatch'
  | 'missing_service'
  | 'expired_banner';

export type MonitorSeverity = 'critical' | 'warning' | 'opportunity';

export type IncidentStatus =
  | 'open'
  | 'fix_suggested'
  | 'fix_approved'
  | 'fix_applied'
  | 'resolved'
  | 'dismissed'
  | 'failed';

export type FixProposalStatus = 'pending' | 'approved' | 'applied' | 'rejected' | 'failed';

export type FixRiskLevel = 'safe' | 'medium' | 'requires_owner';

export type PatchType =
  | 'restore_phone'
  | 'restore_hours'
  | 'restore_main_service'
  | 'remove_expired_banner'
  | 'redeploy_only';

export interface BannerRule {
  text: string;
  expiresAt: string;
}

export interface ProposedChange {
  patchType: PatchType;
  targetFiles: string[];
  payload: Record<string, unknown>;
}

export interface CheckResult {
  passed: boolean;
  observedValue?: string;
  evidence?: Record<string, unknown>;
}

export interface WatchCheckContext {
  liveUrl: string;
  html: string;
  httpStatus: number;
}

export const MONITOR_TO_INCIDENT: Record<MonitorType, IncidentType> = {
  uptime: 'site_down',
  phone: 'phone_mismatch',
  hours: 'hours_mismatch',
  service_visibility: 'missing_service',
  banner_expiry: 'expired_banner',
};

export const MAX_FIX_ATTEMPTS = 2;
