import type { CheckResult, WatchCheckContext } from '@/lib/site-manager/types';

export function runUptimeCheck(ctx: WatchCheckContext, _expectedUrl: string): CheckResult {
  if (ctx.httpStatus === 0) {
    return { passed: false, observedValue: 'unreachable', evidence: { error: 'Site unreachable' } };
  }
  if (ctx.httpStatus < 200 || ctx.httpStatus >= 400) {
    return { passed: false, observedValue: String(ctx.httpStatus), evidence: { httpStatus: ctx.httpStatus } };
  }
  return { passed: true, observedValue: String(ctx.httpStatus) };
}
