import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';
import type { EditWhatKind } from '@/lib/project-workspace/edit-shared/types';
import { heroFieldPath, sectionFieldPath, sectionItemFieldPath } from './configFieldPaths';
import {
  extractReplacementValue,
  inferPinnedContactSectionCopy,
  stripPinnedTargetSuffix,
} from './pinnedContactSectionCopy';
import type { SelectedTargetContext } from './selectedTargetContext';

export interface InferredFieldEdit {
  fieldPath: string;
  value?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  /** When true, caller should route to style/theme instead of copy. */
  skipCopyInference?: boolean;
}

function extractQuotedValue(message: string): string | null {
  return extractReplacementValue(message);
}

function wantsTitle(message: string): boolean {
  return /\b(title|headline|rename)\b/i.test(message);
}

function wantsSubtitle(message: string): boolean {
  return /\b(subtitle|subheadline|tagline)\b/i.test(message);
}

function wantsBody(message: string): boolean {
  return /\b(body|description|copy|rewrite|wording)\b/i.test(message);
}

function wantsCta(message: string): boolean {
  return /\b(cta|button|call to action)\b/i.test(message);
}

function wantsImage(message: string): boolean {
  return /\b(image|photo|picture|replace)\b/i.test(message);
}

function pickTitlePath(ctx: SelectedTargetContext): string | undefined {
  if (ctx.resolved.kind === 'hero') {
    return heroFieldPath('headline');
  }
  const idx = ctx.resolved.sectionIndex;
  if (idx == null) return undefined;
  const titlePath = sectionFieldPath(idx, 'title');
  const hasTitle = ctx.editableFields.some((f) => f.fieldPath === titlePath);
  if (hasTitle) return titlePath;
  const firstItemTitle = ctx.editableFields.find((f) =>
    f.fieldPath.match(new RegExp(`^sections\\[${idx}\\]\\.items\\[\\d+\\]\\.title$`))
  );
  if (firstItemTitle) return firstItemTitle.fieldPath;
  const bodyPath = sectionFieldPath(idx, 'body');
  if (ctx.editableFields.some((f) => f.fieldPath === bodyPath)) return bodyPath;
  return ctx.recommendedDefaultField?.fieldPath;
}

function pickSubtitlePath(ctx: SelectedTargetContext): string | undefined {
  if (ctx.resolved.kind === 'hero') {
    if (ctx.editableFields.some((f) => f.fieldPath === heroFieldPath('subheadline'))) {
      return heroFieldPath('subheadline');
    }
    return heroFieldPath('tagline');
  }
  const idx = ctx.resolved.sectionIndex;
  if (idx == null) return undefined;
  const subtitlePath = sectionFieldPath(idx, 'subtitle');
  if (ctx.editableFields.some((f) => f.fieldPath === subtitlePath)) return subtitlePath;
  return sectionFieldPath(idx, 'body');
}

function pickBodyPath(ctx: SelectedTargetContext): string | undefined {
  const idx = ctx.resolved.sectionIndex;
  if (idx == null) return undefined;
  if (ctx.element?.itemIndex != null) {
    const itemPath = sectionItemFieldPath(idx, ctx.element.itemIndex, 'description');
    if (ctx.editableFields.some((f) => f.fieldPath === itemPath)) return itemPath;
  }
  const bodyPath = sectionFieldPath(idx, 'body');
  if (ctx.editableFields.some((f) => f.fieldPath === bodyPath)) return bodyPath;
  return pickTitlePath(ctx);
}

function pickCtaPath(ctx: SelectedTargetContext): string | undefined {
  const idx = ctx.resolved.sectionIndex;
  if (idx == null) return undefined;
  if (ctx.element?.itemIndex != null) {
    const labelPath = sectionItemFieldPath(idx, ctx.element.itemIndex, 'label');
    if (ctx.editableFields.some((f) => f.fieldPath === labelPath)) return labelPath;
  }
  const titlePath = sectionFieldPath(idx, 'title');
  if (ctx.editableFields.some((f) => f.fieldPath === titlePath)) return titlePath;
  const firstLabel = ctx.editableFields.find((f) => f.fieldPath.endsWith('.label'));
  return firstLabel?.fieldPath;
}

function pickImagePath(ctx: SelectedTargetContext): string | undefined {
  const idx = ctx.resolved.sectionIndex;
  if (idx == null) return undefined;
  const itemIndex = ctx.element?.itemIndex ?? 0;
  const imagePath = sectionItemFieldPath(idx, itemIndex, 'imageUrl');
  if (ctx.editableFields.some((f) => f.fieldPath === imagePath)) return imagePath;
  return ctx.editableFields.find((f) => f.fieldPath.endsWith('.imageUrl'))?.fieldPath;
}

/**
 * Deterministically infer config field path (+ optional value) for a pinned preview target.
 */
export function inferSelectedTargetField(
  message: string,
  ctx: SelectedTargetContext | undefined,
  what?: EditWhatKind
): InferredFieldEdit | null {
  if (!ctx || ctx.resolved.confidence === 'low') return null;

  const classified = what ?? classifyEditWhat(message);
  if (
    classified === 'style_background' ||
    classified === 'style_card' ||
    classified === 'style_text' ||
    /\b(black|white|red|blue|green|yellow|gray|grey|purple|orange|pink|brown)\b/i.test(message)
  ) {
    return { fieldPath: '', confidence: 'high', reason: 'Style edit — skip copy inference', skipCopyInference: true };
  }

  const normalizedMessage = stripPinnedTargetSuffix(message);
  if (/\b(phone|number|email|address)\b/i.test(normalizedMessage)) {
    return null;
  }

  if (ctx.element?.fieldPath) {
    const value = extractReplacementValue(message) ?? undefined;
    return {
      fieldPath: ctx.element.fieldPath,
      value,
      confidence: 'high',
      reason: 'UI-pinned element field path',
    };
  }

  const pinnedContactCopy = inferPinnedContactSectionCopy(message, ctx);
  if (pinnedContactCopy) {
    return {
      fieldPath: pinnedContactCopy.fieldPath,
      value: pinnedContactCopy.value,
      confidence: 'high',
      reason: 'Pinned contact section copy (contact information wording)',
    };
  }

  if (ctx.recommendedDefaultField && !wantsTitle(message) && !wantsSubtitle(message) && !wantsBody(message)) {
    const value = extractReplacementValue(message) ?? undefined;
    if (value) {
      return {
        fieldPath: ctx.recommendedDefaultField.fieldPath,
        value,
        confidence: 'medium',
        reason: ctx.recommendedDefaultField.reason,
      };
    }
  }

  const value = extractReplacementValue(message) ?? undefined;

  if (wantsImage(message)) {
    const fieldPath = pickImagePath(ctx);
    if (fieldPath) {
      return { fieldPath, value, confidence: 'medium', reason: 'Image field inference' };
    }
    return null;
  }

  if (wantsCta(message)) {
    const fieldPath = pickCtaPath(ctx);
    if (fieldPath) {
      return { fieldPath, value, confidence: value ? 'high' : 'medium', reason: 'CTA label inference' };
    }
  }

  if (wantsSubtitle(message)) {
    const fieldPath = pickSubtitlePath(ctx);
    if (fieldPath) {
      return {
        fieldPath,
        value,
        confidence: value ? 'high' : 'medium',
        reason: 'Subtitle/subheadline inference',
      };
    }
  }

  if (wantsBody(message)) {
    const fieldPath = pickBodyPath(ctx);
    if (fieldPath) {
      return {
        fieldPath,
        value,
        confidence: value ? 'high' : 'medium',
        reason: 'Body/description inference',
      };
    }
  }

  if (wantsTitle(message) || (value && classified === 'copy')) {
    const fieldPath = pickTitlePath(ctx);
    if (fieldPath) {
      return {
        fieldPath,
        value,
        confidence: value ? 'high' : 'medium',
        reason: wantsTitle(message) ? 'Title/headline inference' : 'Pinned copy edit with extracted value',
      };
    }
  }

  if (value && ctx.resolved.confidence === 'high') {
    const fieldPath = ctx.recommendedDefaultField?.fieldPath ?? pickTitlePath(ctx);
    if (fieldPath) {
      return {
        fieldPath,
        value,
        confidence: 'high',
        reason: 'Pinned target with quoted replacement value',
      };
    }
  }

  return null;
}

/** Build field-specific clarification when pin exists but field is ambiguous. */
export function buildFieldClarification(
  ctx: SelectedTargetContext
): { message: string; suggestedReplies: string[] } | null {
  if (ctx.editableFields.length < 2) return null;

  const top = ctx.editableFields.slice(0, 5);
  const lines = top.map((f, i) => `${i + 1}. ${f.label} (${f.fieldPath})`);
  return {
    message:
      `Which field in "${ctx.resolved.sectionTitle ?? ctx.resolved.kind}" should I update?\n\n` +
      lines.join('\n'),
    suggestedReplies: top.map((_, i) => String(i + 1)),
  };
}
