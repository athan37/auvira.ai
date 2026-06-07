'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/cn';
import { APPLE_EASE, SCROLL_VIEWPORT, useReducedMotion } from './tokens';

type PromoGlassRevealProps = HTMLMotionProps<'div'> & {
  children: React.ReactNode;
};

/** Cinematic scroll reveal for promo glass visual — 850ms, subtle lift + scale. */
export function PromoGlassReveal({ className, children, ...props }: PromoGlassRevealProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial={{
        opacity: reduced ? 1 : 0,
        y: reduced ? 0 : 6,
        scale: reduced ? 1 : 0.98,
      }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={SCROLL_VIEWPORT}
      transition={{
        duration: reduced ? 0 : 0.85,
        ease: APPLE_EASE,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

type PromoAtmosphereFadeProps = HTMLMotionProps<'div'>;

/** Fades promo atmosphere layer in on scroll. */
export function PromoAtmosphereFade({ className, ...props }: PromoAtmosphereFadeProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={cn('pointer-events-none absolute inset-0 bg-rose-atmosphere', className)}
      initial={{ opacity: reduced ? 1 : 0 }}
      whileInView={{ opacity: 1 }}
      viewport={SCROLL_VIEWPORT}
      transition={{ duration: reduced ? 0 : 0.7, ease: APPLE_EASE }}
      aria-hidden
      {...props}
    />
  );
}
