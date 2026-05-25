import type { IncidentType } from './types';

export function healthyCopy(lastCheckedAt?: Date): { headline: string; body: string; status: 'healthy' } {
  const when = lastCheckedAt
    ? `${Math.max(1, Math.floor((Date.now() - lastCheckedAt.getTime()) / 60_000))} minutes ago`
    : 'recently';
  return {
    status: 'healthy',
    headline: 'Business Watch — All good',
    body: `Your live site loaded normally. Last checked: ${when}.`,
  };
}

export function setupCopy(): { headline: string; body: string; status: 'setup' } {
  return {
    status: 'setup',
    headline: 'Set up Business Watch',
    body: 'Confirm your business details so we can check your live site for you.',
  };
}

export function issueCopy(
  type: IncidentType,
  expected?: string,
  observed?: string
): { headline: string; body: string; status: 'issue' } {
  const bodies: Record<IncidentType, string> = {
    site_down: 'Your live website is not loading correctly.',
    phone_mismatch: `Your phone number does not match the number you confirmed.${expected ? ` Expected: ${expected}.` : ''}`,
    hours_mismatch: `Your business hours may not be showing correctly.${expected ? ` Expected: ${expected}.` : ''}`,
    missing_service: `Your main service may not be visible.${expected ? ` Expected: ${expected}.` : ''}`,
    expired_banner: `An expired notice may still be showing.${observed ? ` "${observed}"` : ''}`,
  };
  return {
    status: 'issue',
    headline: 'We found an issue on your live site',
    body: bodies[type],
  };
}

export function fixedCopy(
  type: IncidentType,
  detail?: string
): { headline: string; body: string; status: 'fixed' } {
  const actions: Partial<Record<IncidentType, string>> = {
    phone_mismatch: detail ? `Restored ${detail}` : 'Restored your phone number',
    hours_mismatch: 'Updated your business hours',
    missing_service: detail ? `Restored ${detail}` : 'Restored your main service',
    expired_banner: 'Removed the expired notice',
    site_down: 'Republished your live website',
  };
  return {
    status: 'fixed',
    headline: 'We fixed your live site',
    body: `${actions[type] ?? 'Applied the fix'}. Verified on your live website.`,
  };
}
