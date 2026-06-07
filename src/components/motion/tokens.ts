'use client';

import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';

/** Apple-like easing curve. */
export const APPLE_EASE = [0.25, 0.1, 0.25, 1] as const;

/** Default entrance duration (seconds). */
export const ENTRANCE_DURATION = 0.6;

/** Stagger delay between hero children (seconds). */
export const STAGGER_DELAY = 0.08;

/** Spring config for product float. */
export const PRODUCT_SPRING = { stiffness: 260, damping: 28 } as const;

/** Scroll reveal viewport defaults. */
export const SCROLL_VIEWPORT = { once: true, margin: '-10%' as const };

/** Whether the user prefers reduced motion. */
export function useReducedMotion(): boolean {
  return useFramerReducedMotion() ?? false;
}

/** Fade-in y offset; zero when reduced motion. */
export function revealOffset(reduced: boolean): number {
  return reduced ? 0 : 24;
}
