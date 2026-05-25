import type { CheckResult, WatchCheckContext } from '@/lib/site-manager/types';

export function runServiceVisibilityCheck(ctx: WatchCheckContext, mainServices: string[]): CheckResult {
  const primary = mainServices[0]?.trim();
  if (!primary) return { passed: true, evidence: { skipped: true } };
  const passed = ctx.html.toLowerCase().includes(primary.toLowerCase());
  return { passed, observedValue: passed ? primary : 'missing', evidence: { mainService: primary } };
}
