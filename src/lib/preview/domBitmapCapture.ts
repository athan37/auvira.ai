/** Max output width for DOM bitmap drag previews (CSS px). */
export const DOM_BITMAP_MAX_WIDTH = 400;

/** Max output height for section DOM bitmap captures (CSS px). */
export const DOM_BITMAP_SECTION_MAX_HEIGHT = 240;

/** Max output height for element DOM bitmap captures (CSS px). */
export const DOM_BITMAP_ELEMENT_MAX_HEIGHT = 120;

/** Async capture timeout passed to modern-screenshot (ms). */
export const DOM_BITMAP_CAPTURE_TIMEOUT_MS = 800;

export interface DomBitmapDimensions {
  width: number;
  height: number;
  offsetY: number;
}

/** Compute clipped capture box for a section or element root. */
export function resolveDomBitmapDimensions(
  rect: { width: number; height: number },
  options: { isSection: boolean; clickOffsetTop?: number }
): DomBitmapDimensions {
  const srcW = Math.max(Math.round(rect.width), 1);
  const srcH = Math.max(Math.round(rect.height), 1);
  const maxH = options.isSection ? DOM_BITMAP_SECTION_MAX_HEIGHT : DOM_BITMAP_ELEMENT_MAX_HEIGHT;
  const clipH = options.isSection
    ? Math.min(maxH, Math.max(srcH, 80))
    : Math.min(Math.max(srcH, 24), maxH);
  const width = Math.min(srcW, DOM_BITMAP_MAX_WIDTH);
  const height = clipH;
  let offsetY = 0;
  if (options.isSection && options.clickOffsetTop != null) {
    offsetY = Math.max(0, Math.min(options.clickOffsetTop - clipH / 2, Math.max(srcH - clipH, 0)));
    offsetY = Math.round(offsetY);
  }
  return { width, height, offsetY };
}

/** True when a capture should use section-scale display treatment. */
export function isDomBitmapSectionScale(width: number, height: number, isSection: boolean): boolean {
  return isSection || (width >= 240 && height >= 100);
}
