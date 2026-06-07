'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { APPLE_EASE, ENTRANCE_DURATION, STAGGER_DELAY, useReducedMotion } from './tokens';

type StaggerChildrenProps = {
  className?: string;
  children: React.ReactNode;
  stagger?: number;
};

/** Stagger child fade-in animations (direct children must accept motion). */
export function StaggerChildren({
  className,
  children,
  stagger = STAGGER_DELAY,
}: StaggerChildrenProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: reduced ? 0 : stagger,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

type StaggerItemProps = {
  className?: string;
  children: React.ReactNode;
};

/** Child item for StaggerChildren. */
export function StaggerItem({ className, children }: StaggerItemProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      variants={{
        hidden: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: reduced ? 0 : ENTRANCE_DURATION, ease: APPLE_EASE },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
