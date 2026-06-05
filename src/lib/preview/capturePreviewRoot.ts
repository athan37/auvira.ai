import type { TargetChainNode } from '@/lib/preview/targetChain';

export interface CaptureRootInput {
  sectionEl: Element;
  clickTarget: Element;
  targetChain?: TargetChainNode[];
  pinScope?: 'section' | 'element';
}

const CARD_CLASS_HINTS = ['rounded-3xl', 'rounded-2xl', 'rounded-[2rem]'];
const SECTION_TITLE_FIELD = /^sections\[\d+\]\.title$/;
const SECTION_BODY_FIELD = /^sections\[\d+\]\.body$/;

function hasCardClassHint(el: Element): boolean {
  const cls = el.getAttribute('class') ?? '';
  return CARD_CLASS_HINTS.some((hint) => cls.includes(hint)) && cls.includes('border');
}

function findItemCardWrapper(el: Element, sectionEl: Element): Element | null {
  let node: Element | null = el;
  while (node && node !== sectionEl) {
    if (hasCardClassHint(node)) return node;
    node = node.parentElement;
  }
  return null;
}

function findAnnotatedLeaf(el: Element, sectionEl: Element): Element | null {
  let node: Element | null = el;
  while (node && node !== sectionEl) {
    if (node.getAttribute?.('data-site-element-kind')) return node;
    node = node.parentElement;
  }
  return null;
}

function isTinyElement(el: Element): boolean {
  if (typeof (el as HTMLElement).getBoundingClientRect !== 'function') return false;
  const rect = (el as HTMLElement).getBoundingClientRect();
  return rect.width < 24 || rect.height < 16;
}

function isSectionElement(el: Element): boolean {
  return (
    el.tagName === 'SECTION' ||
    el.hasAttribute('data-site-section-id') ||
    el.hasAttribute('data-site-section-type')
  );
}

function isSectionOverviewField(fieldPath?: string): boolean {
  if (!fieldPath) return false;
  return SECTION_TITLE_FIELD.test(fieldPath) || SECTION_BODY_FIELD.test(fieldPath);
}

/**
 * True when the drag preview should rasterize the whole section (nested layout included).
 */
export function shouldCaptureFullSectionPreview(input: CaptureRootInput): boolean {
  const { targetChain, pinScope } = input;
  if (pinScope !== 'element') return true;
  const leaf = targetChain?.length ? targetChain[targetChain.length - 1] : undefined;
  if (!leaf || leaf.role === 'section') return true;
  if (leaf.role === 'element' && isSectionOverviewField(leaf.fieldPath)) return true;
  return false;
}

/**
 * Pick the DOM subtree to rasterize for a drag target preview thumbnail.
 */
export function resolveCaptureRoot(input: CaptureRootInput): Element {
  const { sectionEl, clickTarget, targetChain, pinScope } = input;
  const leaf = targetChain?.length ? targetChain[targetChain.length - 1] : undefined;
  const leafKind = leaf?.role === 'element' ? leaf.kind : undefined;

  if (pinScope !== 'element' && !leaf?.fieldPath) {
    return sectionEl;
  }

  if (leafKind === 'item_title' || leafKind === 'item_body' || leafKind === 'image_caption' || leafKind === 'item_card') {
    const card = findItemCardWrapper(clickTarget, sectionEl);
    if (card) return card;
  }

  const annotated = findAnnotatedLeaf(clickTarget, sectionEl) ?? clickTarget;
  if (
    annotated.getAttribute?.('data-site-element-kind') === 'item_card' &&
    annotated !== sectionEl
  ) {
    return annotated;
  }
  if (isTinyElement(annotated) && annotated.parentElement && annotated.parentElement !== sectionEl) {
    return annotated.parentElement;
  }

  if (leafKind === 'contact_field' || leafKind === 'button' || leafKind === 'heading') {
    return annotated;
  }

  const card = findItemCardWrapper(clickTarget, sectionEl);
  if (card) return card;

  return annotated;
}

/**
 * Preview capture may promote element pins (section title/intro) to the full section subtree.
 */
export function resolvePreviewCaptureRoot(input: CaptureRootInput): Element {
  if (shouldCaptureFullSectionPreview(input)) {
    return input.sectionEl;
  }
  return resolveCaptureRoot(input);
}

export interface SectionCaptureClip {
  width: number;
  height: number;
  offsetY: number;
}

/** Clip dimensions for full-section preview raster (shows nested layout). */
export function resolveSectionCaptureClip(sectionEl: Element, clickTarget: Element): SectionCaptureClip {
  const rect = sectionEl.getBoundingClientRect();
  const width = Math.min(Math.max(Math.round(rect.width), 1), 560);
  const clipHeight = Math.min(220, Math.max(Math.round(rect.height), 1));
  const clickRect = clickTarget.getBoundingClientRect();
  const clickOffset = clickRect.top - rect.top;
  const offsetY = Math.max(0, Math.min(clickOffset - clipHeight / 2, Math.max(rect.height - clipHeight, 0)));
  return { width, height: clipHeight, offsetY: Math.round(offsetY) };
}

export { isSectionElement, isSectionOverviewField };
