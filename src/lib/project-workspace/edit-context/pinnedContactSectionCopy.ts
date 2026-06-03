import type { SelectedTargetContext } from './selectedTargetContext';
import { sectionFieldPath } from './configFieldPaths';

const PINNED_TARGET_SUFFIX = /\s*\(UI-selected section:[^)]*\)\s*$/i;

/** Remove UI pin hint appended to effectiveMessage during edit context build. */
export function stripPinnedTargetSuffix(message: string): string {
  return message.replace(PINNED_TARGET_SUFFIX, '').trim();
}

/** Owner names the inner contact panel without specifying phone, email, or address. */
export function wantsContactSectionCopy(message: string): boolean {
  const normalized = stripPinnedTargetSuffix(message);
  if (/\b(phone|number|email|address)\b/i.test(normalized)) return false;
  return /\bcontact\s+(information|info)\b/i.test(normalized);
}

/** Extract replacement text from quoted or unquoted "… to …" copy edits. */
export function extractReplacementValue(message: string): string | null {
  const normalized = stripPinnedTargetSuffix(message);
  const quoted = normalized.match(/\bto\s+["']([^"']+)["']/i);
  if (quoted?.[1]) return quoted[1].trim();

  const changeTitle = normalized.match(
    /\b(?:change|update|set|make)\s+(?:the\s+)?(?:title|headline)\s+(?:to\s+)?["']?([^"'.]+?)["']?\s*$/i
  );
  if (changeTitle?.[1]) return changeTitle[1].trim();

  const unquoted = normalized.match(/\b(?:change|update|set|make|edit)\s+.+\s+to\s+(.+?)\s*$/i);
  if (unquoted?.[1]) {
    const value = unquoted[1].trim();
    if (value.length >= 2) return value;
  }

  return null;
}

function pickContactSectionCopyPath(ctx: SelectedTargetContext): string | undefined {
  const idx = ctx.resolved.sectionIndex;
  if (idx == null) return undefined;

  const bodyPath = sectionFieldPath(idx, 'body');
  if (ctx.editableFields.some((f) => f.fieldPath === bodyPath)) {
    return bodyPath;
  }

  const titlePath = sectionFieldPath(idx, 'title');
  if (ctx.editableFields.some((f) => f.fieldPath === titlePath)) {
    return titlePath;
  }

  return ctx.recommendedDefaultField?.fieldPath;
}

/** True when a pinned contact section should receive section copy, not siteConfig.contact. */
export function isPinnedContactSectionCopyIntent(
  message: string,
  ctx: SelectedTargetContext | undefined
): boolean {
  if (!ctx || ctx.resolved.sectionType !== 'contact') return false;
  if (!wantsContactSectionCopy(message)) return false;
  return Boolean(extractReplacementValue(message));
}

/** Resolve section field path + value for pinned contact-section copy edits. */
export function inferPinnedContactSectionCopy(
  message: string,
  ctx: SelectedTargetContext
): { fieldPath: string; value: string } | null {
  if (!isPinnedContactSectionCopyIntent(message, ctx)) return null;
  const value = extractReplacementValue(message);
  const fieldPath = pickContactSectionCopyPath(ctx);
  if (!value || !fieldPath) return null;
  return { fieldPath, value };
}
