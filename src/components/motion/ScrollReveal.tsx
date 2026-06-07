'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/cn';
import { APPLE_EASE, ENTRANCE_DURATION, SCROLL_VIEWPORT, revealOffset, useReducedMotion } from './tokens';

type ScrollRevealProps = HTMLMotionProps<'div'> & {
  delay?: number;
};

/** Scroll-triggered fade + slide-up. */
export function ScrollReveal({
  className,
  delay = 0,
  children,
  ...props
}: ScrollRevealProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: reduced ? 1 : 0, y: revealOffset(reduced) }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={SCROLL_VIEWPORT}
      transition={{ duration: reduced ? 0 : ENTRANCE_DURATION, delay, ease: APPLE_EASE }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
