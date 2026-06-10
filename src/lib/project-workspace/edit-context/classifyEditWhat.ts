import { hasExplicitEditTarget } from '@/lib/project-workspace/edit-shared/editTargetUtils';
import type { EditWhatKind } from '@/lib/project-workspace/edit-shared/types';
import { stripPinnedTargetSuffix } from '@/lib/project-workspace/edit-context/configTextEditUtils';
import { detectImplicitPhrases } from '@/lib/project-workspace/edit-context/implicitReferencePhrases';
import { shouldExtractImplicitRefs } from '@/lib/project-workspace/edit-context/extractImplicitReferences';
import {
  isBackgroundColorEditRequest,
  isTextColorEditRequest,
} from '@/lib/project-workspace/verifyPreviewHints';

function messageHasKeyword(message: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(message);
}

/** Classify WHAT the owner wants to change from the message. */
export function classifyEditWhat(message: string): EditWhatKind {
  const lower = stripPinnedTargetSuffix(message).toLowerCase();
  const hasColorSignal =
    /\b(backgrounds?|colours?|colors?)\b/.test(lower) ||
    isBackgroundColorEditRequest(message) ||
    isTextColorEditRequest(message);

  if (/\bcard\b/.test(lower) && /\b(backgrounds?|colours?|colors?)\b/.test(lower)) {
    return 'style_card';
  }

  if (
    isTextColorEditRequest(message) ||
    (/\btext\b/.test(lower) && /\b(colours?|colors?)\b/.test(lower))
  ) {
    return 'style_text';
  }

  if (
    isBackgroundColorEditRequest(message) ||
    (/\bbackgrounds?\b/.test(lower) && !/\bcard\b/.test(lower))
  ) {
    return 'style_background';
  }

  if (/\b(image|photo|picture|gallery|upload)\b/.test(lower) && !hasColorSignal) {
    return 'images';
  }

  const hasImplicitColor =
    detectImplicitPhrases(message).some((hit) => hit.kind === 'color') ||
    (/\bcolou?rs?\b/i.test(message) && shouldExtractImplicitRefs(message));

  if (hasImplicitColor) {
    return 'style_background';
  }

  if (
    (/\b(add|remove|delete|reorder|move|append|insert|duplicate)\b/.test(lower) ||
      /\bfaq\b/.test(lower)) &&
    !/\b(background|colour|color)\b/.test(lower)
  ) {
    return 'structure';
  }

  if (
    /\b(text|copy|headline|title|body|wording|rename|edit)\b/.test(lower) ||
    hasExplicitEditTarget(message)
  ) {
    return 'copy';
  }

  if (messageHasKeyword(lower, 'section')) {
    return 'structure';
  }

  return 'structure';
}
