'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/cn';
import { APPLE_EASE, ENTRANCE_DURATION, revealOffset, useReducedMotion } from './tokens';

type FadeInProps = HTMLMotionProps<'div'> & {
  delay?: number;
  duration?: number;
};

/** Simple fade + optional slide-up entrance. */
export function FadeIn({
  className,
  delay = 0,
  duration = ENTRANCE_DURATION,
  children,
  ...props
}: FadeInProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: revealOffset(reduced) }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : duration, delay, ease: APPLE_EASE }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
