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

/** Hero/contact rounded card wrapper when the click target is inside it. */
export function findInnerCardWrapper(sectionEl: Element, clickTarget: Element): Element | null {
  let node: Element | null = clickTarget;
  while (node && node !== sectionEl) {
    if (node.getAttribute?.('data-site-container-kind') === 'inner_card') return node;
    if (hasCardClassHint(node)) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * True when preview should rasterize the inner card shell (not a leaf row/chip inside it).
 */
export function shouldUseInnerCardPreviewCapture(input: CaptureRootInput): boolean {
  if (!findInnerCardWrapper(input.sectionEl, input.clickTarget)) return false;
  if (input.pinScope !== 'element') return true;
  const leaf = input.targetChain?.length ? input.targetChain[input.targetChain.length - 1] : undefined;
  if (!leaf || leaf.role !== 'element') return true;
  if (isSectionOverviewField(leaf.fieldPath)) return false;
  if (leaf.fieldPath) return false;
  return true;
}

/**
 * True when the drag preview should rasterize the whole section (nested layout included).
 * Element pins (including section title/body fields) use compact styled text capture instead.
 */
export function shouldCaptureFullSectionPreview(input: CaptureRootInput): boolean {
  const { sectionEl, clickTarget, targetChain, pinScope } = input;
  if (findInnerCardWrapper(sectionEl, clickTarget)) return false;
  if (pinScope !== 'element') return true;
  const leaf = targetChain?.length ? targetChain[targetChain.length - 1] : undefined;
  if (!leaf || leaf.role === 'section') return true;
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

  if (leafKind === 'contact_field' || leafKind === 'button' || leafKind === 'heading' || leafKind === 'body') {
    return annotated;
  }

  const card = findItemCardWrapper(clickTarget, sectionEl);
  if (card) return card;

  return annotated;
}

const ITEM_CARD_CAPTURE_KINDS = new Set([
  'item_card',
  'item_title',
  'item_body',
  'image_caption',
]);

/** Pick the DOM node to rasterize for drag preview (may differ from click target). */
export function resolveDragCaptureElement(input: {
  sectionEl: Element;
  clickTarget: Element;
  root: Element;
  innerCard?: Element | null;
  fullSection: boolean;
  leafKind?: string;
  pinScope?: string;
}): Element {
  const { sectionEl, clickTarget, root, innerCard, fullSection, leafKind, pinScope } = input;
  if (innerCard) return innerCard;
  if (fullSection) return root;
  if (pinScope === 'element') {
    if (leafKind && ITEM_CARD_CAPTURE_KINDS.has(leafKind)) {
      const card = findItemCardWrapper(clickTarget, sectionEl);
      if (card) return card;
    }
    if (leafKind === 'panel' && root !== sectionEl) return root;
    return clickTarget;
  }
  return root;
}

/**
 * Preview capture may promote element pins (section title/intro) to the full section subtree.
 */
export function resolvePreviewCaptureRoot(input: CaptureRootInput): Element {
  if (shouldUseInnerCardPreviewCapture(input)) {
    const innerCard = findInnerCardWrapper(input.sectionEl, input.clickTarget);
    if (innerCard) return innerCard;
  }
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
