import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { summarizeActualChanges } from '@/lib/project-workspace/website-edit-agent/verifyEditApplied';
import type { DomainToolContext, DomainToolResult } from './types';

/**
 * Build owner summary from actual saved source, not LLM text.
 */
export async function summarizeActualChangesTool(
  ctx: DomainToolContext
): Promise<DomainToolResult> {
  const siteConfigPath = 'src/lib/siteConfig.ts';
  const beforeSite = ctx.beforeFiles[siteConfigPath] ?? '';
  const afterSite = ctx.afterFiles[siteConfigPath] ?? beforeSite;

  if (beforeSite && afterSite && beforeSite !== afterSite) {
    const beforeParsed = parseSiteConfigSource(beforeSite);
    const afterParsed = parseSiteConfigSource(afterSite);
    const sections = afterParsed?.sections ?? [];

    for (let i = 0; i < sections.length; i++) {
      const afterSection = sections[i] as {
        title?: string;
        presentation?: { backgroundClass?: string };
      };
      const beforeSection = beforeParsed?.sections?.[i] as
        | { presentation?: { backgroundClass?: string } }
        | undefined;
      const afterBg = afterSection.presentation?.backgroundClass?.trim();
      const beforeBg = beforeSection?.presentation?.backgroundClass?.trim();
      if (afterBg && afterBg !== beforeBg) {
        const title = afterSection.title ?? `section ${i + 1}`;
        return {
          ok: true,
          changedFiles: [],
          summary: `Changed background of "${title}" to ${afterBg}.`,
        };
      }
    }

    const contact = afterParsed?.contact;
    const beforeContact = beforeParsed?.contact;
    if (contact && beforeContact) {
      for (const field of ['phone', 'email', 'address'] as const) {
        const afterVal = contact[field];
        const beforeVal = beforeContact[field];
        if (afterVal && afterVal !== beforeVal) {
          return {
            ok: true,
            changedFiles: [],
            summary: `Updated contact ${field} to ${afterVal}.`,
            evidence: { field, value: String(afterVal) },
          };
        }
      }
    }

    const heroMatch = afterSite.match(/headline:\s*['"]([^'"]+)['"]/);
    const beforeHeroMatch = beforeSite.match(/headline:\s*['"]([^'"]+)['"]/);
    if (heroMatch?.[1] && beforeHeroMatch?.[1] && heroMatch[1] !== beforeHeroMatch[1]) {
      return {
        ok: true,
        changedFiles: [],
        summary: `Updated hero headline.`,
        evidence: { field: 'headline', value: heroMatch[1] },
      };
    }
  }

  const fallback = summarizeActualChanges(
    ctx.editContext.ownerMessage,
    ctx.beforeFiles,
    { ...ctx.beforeFiles, ...ctx.afterFiles }
  );

  return {
    ok: true,
    changedFiles: [],
    summary: fallback,
  };
}
