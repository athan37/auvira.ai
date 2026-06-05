/** Keep the drag ghost fully visible inside the viewport. */
export function clampDragGhostPosition(options: {
  pointerX: number;
  pointerY: number;
  grabOffsetX?: number;
  grabOffsetY?: number;
  ghostWidth?: number;
  ghostHeight?: number;
  margin?: number;
}): { left: number; top: number } {
  const {
    pointerX,
    pointerY,
    grabOffsetX = 12,
    grabOffsetY = 12,
    ghostWidth = 200,
    ghostHeight = 160,
    margin = 8,
  } = options;

  const viewportWidth =
    typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : 1280;
  const viewportHeight =
    typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 720;

  let left = pointerX + grabOffsetX;
  let top = pointerY + grabOffsetY;

  if (left + ghostWidth + margin > viewportWidth) {
    left = Math.max(margin, viewportWidth - ghostWidth - margin);
  }
  if (top + ghostHeight + margin > viewportHeight) {
    top = Math.max(margin, viewportHeight - ghostHeight - margin);
  }
  if (left < margin) left = margin;
  if (top < margin) top = margin;

  return { left, top };
}
