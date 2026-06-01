import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { extractPreviewVerifyHints, htmlShowsTailwindColor } from './verifyPreviewHints';
import { rendererComponentForSectionType } from './edit-shared/legacySectionPresentation';
import { extractSectionComponentSource } from './edit-shared/resolveSectionTarget';

export const PREVIEW_PRESENTATION_POLL_MS = 800;
export const PREVIEW_PRESENTATION_TIMEOUT_MS = 20_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withCacheBust(url: string, attempt: number): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_presentation_sync=${Date.now()}_${attempt}`;
}

/** Tailwind background classes set in siteConfig.sections[].presentation. */
export function presentationBackgroundClassesInSiteConfig(siteConfigContent: string): string[] {
  const parsed = parseSiteConfigSource(siteConfigContent);
  if (!parsed?.sections?.length) return [];
  const classes: string[] = [];
  for (const section of parsed.sections) {
    const bg = (section as { presentation?: { backgroundClass?: string } }).presentation
      ?.backgroundClass;
    if (typeof bg === 'string' && bg.trim()) {
      classes.push(bg.trim());
    }
  }
  return classes;
}

export function sectionPresentationBackgroundClass(
  siteConfigContent: string,
  sectionIndex: number
): string | null {
  const parsed = parseSiteConfigSource(siteConfigContent);
  const section = parsed?.sections?.[sectionIndex] as
    | { presentation?: { backgroundClass?: string } }
    | undefined;
  const bg = section?.presentation?.backgroundClass;
  return typeof bg === 'string' && bg.trim() ? bg.trim() : null;
}

/** Read presentation.cardClass for a section index. */
export function sectionPresentationCardClass(
  siteConfigContent: string,
  sectionIndex: number
): string | null {
  const parsed = parseSiteConfigSource(siteConfigContent);
  const section = parsed?.sections?.[sectionIndex] as
    | { presentation?: { cardClass?: string } }
    | undefined;
  const card = section?.presentation?.cardClass;
  return typeof card === 'string' && card.trim() ? card.trim() : null;
}

/** Expected bg-* classes from owner message color words (e.g. red -> bg-red-200). */
export function expectedBackgroundClassesFromMessage(ownerMessage: string): string[] {
  const hints = extractPreviewVerifyHints(ownerMessage);
  if (!hints.isBackgroundColorRequest && hints.colors.length === 0) {
    return [];
  }
  return [...new Set(hints.colors.map((c) => colorNameToBackgroundClass(c)))];
}

/** True when HTML contains the exact Tailwind class string (not generic color tokens). */
export function htmlContainsExactPresentationClass(
  html: string,
  expectedClass: string
): boolean {
  return expectedClass.length > 0 && html.includes(expectedClass);
}

/**
 * Generic color-word verification (legacy) — can pass when unrelated red classes exist on the page.
 */
export function genericColorHintMatchesHtml(html: string, ownerMessage: string): boolean {
  const hints = extractPreviewVerifyHints(ownerMessage);
  return hints.colors.some((color) => htmlShowsTailwindColor(html, color));
}

/**
 * True when legacy color heuristics pass but the exact presentation class from siteConfig does not.
 */
export function genericColorWouldPassButExactClassMissing(
  html: string,
  ownerMessage: string,
  expectedClasses: string[]
): boolean {
  if (expectedClasses.length === 0) return false;
  const exactHit = expectedClasses.some((cls) => htmlContainsExactPresentationClass(html, cls));
  if (exactHit) return false;
  return genericColorHintMatchesHtml(html, ownerMessage);
}

/** Sections whose renderer ignores siteConfig.presentation (preset.* fallback still wired). */
export function presentationWiringIssues(
  siteConfigContent: string,
  pageContent: string
): string[] {
  const parsed = parseSiteConfigSource(siteConfigContent);
  if (!parsed?.sections?.length) return [];

  const issues: string[] = [];
  for (const section of parsed.sections) {
    const bg = (section as { presentation?: { backgroundClass?: string } }).presentation
      ?.backgroundClass;
    const type = String((section as { type?: string }).type ?? '');
    const component = rendererComponentForSectionType(type);
    const usesResolver = sectionRendererUsesPresentationResolver(pageContent, component);
    if (usesResolver) continue;
    if (bg?.trim() || type === 'contact' || type === 'gallery' || type === 'about') {
      issues.push(`${component} does not use resolveSectionBackground`);
    }
  }
  return issues;
}

/** Section renderer must call resolveSectionBackground or siteConfig.presentation is ignored. */
export function sectionRendererUsesPresentationResolver(
  pageContent: string,
  componentName: string
): boolean {
  const extracted = extractSectionComponentSource(pageContent, componentName);
  if (!extracted) return true;
  return extracted.content.includes('resolveSectionBackground');
}

/**
 * Poll live preview HTML until a Tailwind class from the saved siteConfig appears.
 * Avoids false positives from unrelated red/green elsewhere on the page.
 */
export async function waitForPresentationClassInPreview(
  previewUrl: string,
  expectedClasses: string[],
  options?: { retries?: number; delayMs?: number }
): Promise<{ ok: boolean; reason: string; matchedClass?: string }> {
  const classes = expectedClasses.filter(Boolean);
  if (classes.length === 0) {
    return { ok: true, reason: 'No presentation classes to wait for' };
  }

  const delayMs = options?.delayMs ?? PREVIEW_PRESENTATION_POLL_MS;
  const retries =
    options?.retries ??
    Math.max(1, Math.ceil(PREVIEW_PRESENTATION_TIMEOUT_MS / delayMs));

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      await sleep(delayMs);
    }

    try {
      const res = await fetch(withCacheBust(previewUrl, attempt), {
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(18_000),
      });
      const html = await res.text();
      const hit = classes.find((cls) => html.includes(cls));
      if (hit) {
        return {
          ok: true,
          reason: `Preview HTML includes ${hit}`,
          matchedClass: hit,
        };
      }
    } catch (err) {
      if (attempt === retries - 1) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Preview fetch failed while syncing',
        };
      }
    }
  }

  return {
    ok: false,
    reason: `Preview did not include expected class(es) yet: ${classes.join(', ')}`,
  };
}

/**
 * Resolve classes to wait for: siteConfig source wins, then message-derived colors.
 */
export function resolveExpectedPreviewPresentationClasses(
  siteConfigContent: string | null | undefined,
  ownerMessage: string,
  sectionIndex?: number
): string[] {
  if (siteConfigContent && sectionIndex != null) {
    const fromSection = sectionPresentationBackgroundClass(siteConfigContent, sectionIndex);
    if (fromSection) return [fromSection];
  }
  if (siteConfigContent) {
    const fromConfig = presentationBackgroundClassesInSiteConfig(siteConfigContent);
    if (fromConfig.length > 0) return fromConfig;
  }
  return expectedBackgroundClassesFromMessage(ownerMessage);
}
