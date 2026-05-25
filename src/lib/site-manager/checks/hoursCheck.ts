import type { CheckResult, WatchCheckContext } from '@/lib/site-manager/types';

export function runHoursCheck(ctx: WatchCheckContext, expectedHours: string): CheckResult {
  if (!expectedHours?.trim()) return { passed: true, evidence: { skipped: true } };
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
  const passed = norm(ctx.html.replace(/<[^>]+>/g, ' ')).includes(norm(expectedHours));
  return { passed, observedValue: passed ? expectedHours : 'not_found', evidence: { expectedHours } };
}
