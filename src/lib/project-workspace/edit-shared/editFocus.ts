import type {
  EditFocus,
  EditFocusKind,
  EditFocusStack,
  LastGalleryEdit,
  WebsiteEditAgentResult,
} from './types';

export type { EditFocus, EditFocusKind, EditFocusStack };

export const EDIT_FOCUS_STACK_CAP = 5;

/** Push a focus item onto the stack (newest first). */
export function pushEditFocus(
  priorStack: EditFocusStack | null | undefined,
  focus: EditFocus
): EditFocusStack {
  const items = [focus, ...(priorStack?.items ?? [])].slice(0, EDIT_FOCUS_STACK_CAP);
  return { items };
}

/** Derive legacy gallery artifact from the focus stack. */
export function lastGalleryEditFromFocusStack(
  stack: EditFocusStack | null | undefined
): LastGalleryEdit | null {
  if (!stack?.items.length) return null;
  for (const item of stack.items) {
    if (
      (item.kind === 'section_created' || item.kind === 'gallery_captions') &&
      Array.isArray(item.imageUrls) &&
      typeof item.imageCount === 'number'
    ) {
      return {
        sectionIndex: item.sectionIndex,
        title: item.sectionTitle,
        imageUrls: item.imageUrls,
        imageCount: item.imageCount,
      };
    }
  }
  return null;
}

/** Bootstrap a focus item from legacy gallery metadata. */
export function editFocusFromLastGalleryEdit(
  edit: LastGalleryEdit,
  kind: EditFocusKind = 'section_created'
): EditFocus {
  return {
    kind,
    sectionIndex: edit.sectionIndex,
    sectionTitle: edit.title,
    sectionType: 'gallery',
    imageUrls: edit.imageUrls,
    imageCount: edit.imageCount,
    at: new Date().toISOString(),
  };
}

/** Build focus from a successful agent result. */
export function editFocusFromAgentResult(
  result: WebsiteEditAgentResult,
  editJobId?: string
): EditFocus | null {
  const at = new Date().toISOString();

  if (result.lastGalleryEdit) {
    const lg = result.lastGalleryEdit;
    return {
      kind: result.strategy === 'gallery_captions' ? 'gallery_captions' : 'section_created',
      sectionIndex: lg.sectionIndex,
      sectionTitle: lg.title,
      sectionType: 'gallery',
      imageUrls: lg.imageUrls,
      imageCount: lg.imageCount,
      editJobId,
      at,
    };
  }

  if (result.editFocus) {
    return {
      ...result.editFocus,
      editJobId: result.editFocus.editJobId ?? editJobId,
      at: result.editFocus.at || at,
    };
  }

  return null;
}

/** Update focus stack after a successful edit. */
export function buildEditFocusStackAfterEdit(input: {
  priorStack?: EditFocusStack | null;
  result: WebsiteEditAgentResult;
  editJobId?: string;
}): EditFocusStack {
  const focus = editFocusFromAgentResult(input.result, input.editJobId);
  if (!focus) {
    return input.priorStack ?? { items: [] };
  }
  return pushEditFocus(input.priorStack, focus);
}

/** Validate stored focus stack shape from Mongo metadata. */
export function normalizeEditFocusStack(raw: unknown): EditFocusStack | null {
  if (!raw || typeof raw !== 'object') return null;
  const items = (raw as EditFocusStack).items;
  if (!Array.isArray(items)) return null;

  const normalized: EditFocus[] = [];
  for (const item of items) {
    if (
      item &&
      typeof item.sectionIndex === 'number' &&
      typeof item.sectionTitle === 'string' &&
      typeof item.kind === 'string' &&
      typeof item.at === 'string'
    ) {
      normalized.push(item as EditFocus);
    }
  }
  return normalized.length > 0 ? { items: normalized } : null;
}

/** Section index from focus stack for gallery caption routing. */
export function sectionIndexFromFocusStack(
  focusStack: EditFocusStack | null | undefined
): number | null {
  if (!focusStack?.items.length) return null;
  const galleryKinds = new Set<EditFocusKind>(['section_created', 'gallery_captions']);
  const item = focusStack.items.find((f) => galleryKinds.has(f.kind)) ?? focusStack.items[0];
  return item?.sectionIndex ?? null;
}
