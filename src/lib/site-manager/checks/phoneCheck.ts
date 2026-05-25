import { findConflictingPhone, phoneMatchesInHtml } from '@/lib/site-manager/phoneNormalize';
import type { CheckResult, WatchCheckContext } from '@/lib/site-manager/types';

export function runPhoneCheck(ctx: WatchCheckContext, expectedPhone: string): CheckResult {
  if (!expectedPhone?.trim()) return { passed: true, evidence: { skipped: true } };
  if (phoneMatchesInHtml(expectedPhone, ctx.html)) {
    return { passed: true, observedValue: expectedPhone };
  }
  const conflicting = findConflictingPhone(expectedPhone, ctx.html);
  return {
    passed: false,
    observedValue: conflicting ?? 'not_found',
    evidence: { expectedPhone, conflictingPhone: conflicting },
  };
}
