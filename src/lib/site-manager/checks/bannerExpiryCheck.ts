import type { BannerRule, CheckResult, WatchCheckContext } from '@/lib/site-manager/types';

export function runBannerExpiryCheck(ctx: WatchCheckContext, bannerRules: BannerRule[]): CheckResult {
  const expired = bannerRules.filter((r) => new Date(r.expiresAt) < new Date());
  if (expired.length === 0) return { passed: true, evidence: { skipped: true } };
  const htmlLower = ctx.html.toLowerCase();
  const visible = expired.filter((r) => htmlLower.includes(r.text.toLowerCase()));
  if (visible.length === 0) return { passed: true };
  return { passed: false, observedValue: visible[0].text, evidence: { bannerText: visible[0].text } };
}
