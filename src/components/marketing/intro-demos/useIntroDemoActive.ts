'use client';

import { useRef } from 'react';
import { useInView } from 'framer-motion';

/** True when the demo is in the viewport — loops pause when off-screen. */
export function useIntroDemoActive() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-15%', amount: 0.35 });
  return { ref, active: inView };
}
