import type { ProposedChange } from '../types';
import { applyRemoveExpiredBanner } from './removeExpiredBanner';
import { applyRestoreHours } from './restoreHours';
import { applyRestoreMainService } from './restoreMainService';
import { applyRestorePhone } from './restorePhone';

export { buildRemoveExpiredBannerChange } from './removeExpiredBanner';
export { buildRestoreHoursChange } from './restoreHours';
export { buildRestoreMainServiceChange } from './restoreMainService';
export { buildRestorePhoneChange } from './restorePhone';

export async function applyDeterministicPatch(
  workspacePath: string,
  change: ProposedChange
): Promise<string[]> {
  switch (change.patchType) {
    case 'restore_phone':
      return applyRestorePhone(workspacePath, change.payload as { phone: string });
    case 'restore_hours':
      return applyRestoreHours(workspacePath, change.payload as { hours: string });
    case 'restore_main_service':
      return applyRestoreMainService(workspacePath, change.payload as { service: string });
    case 'remove_expired_banner':
      return applyRemoveExpiredBanner(workspacePath, change.payload as { bannerText: string });
    case 'redeploy_only':
      return [];
    default:
      throw new Error(`Unknown patch: ${change.patchType}`);
  }
}

export function buildRedeployOnlyChange(): ProposedChange {
  return { patchType: 'redeploy_only', targetFiles: [], payload: {} };
}
