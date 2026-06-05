import { describe, expect, it } from 'vitest';
import { clampDragGhostPosition } from '@/lib/preview/clampDragGhostPosition';

describe('clampDragGhostPosition', () => {
  it('offsets ghost from pointer by grab offset', () => {
    const pos = clampDragGhostPosition({
      pointerX: 100,
      pointerY: 200,
      grabOffsetX: 12,
      grabOffsetY: 12,
      ghostWidth: 200,
      ghostHeight: 160,
      margin: 8,
    });
    expect(pos.left).toBe(112);
    expect(pos.top).toBe(212);
  });

  it('clamps ghost inside viewport right and bottom edges', () => {
    const pos = clampDragGhostPosition({
      pointerX: 2000,
      pointerY: 2000,
      grabOffsetX: 12,
      grabOffsetY: 12,
      ghostWidth: 200,
      ghostHeight: 160,
      margin: 8,
    });
    expect(pos.left).toBeLessThan(2000);
    expect(pos.top).toBeLessThan(2000);
  });
});
