'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

const ORBS = [
  {
    className: 'left-[-8%] top-[12%] h-[42vw] w-[42vw] max-h-[420px] max-w-[420px]',
    color: 'rgba(210, 68, 96, 0.32)',
    animate: { x: [0, 48, -24, 0] as number[], y: [0, -32, 24, 0] as number[] },
    duration: 16,
  },
  {
    className: 'right-[-12%] top-[38%] h-[38vw] w-[38vw] max-h-[380px] max-w-[380px]',
    color: 'rgba(221, 131, 153, 0.28)',
    animate: { x: [0, -56, 32, 0] as number[], y: [0, 40, -28, 0] as number[] },
    duration: 20,
  },
  {
    className: 'left-[20%] bottom-[-10%] h-[36vw] w-[36vw] max-h-[360px] max-w-[360px]',
    color: 'rgba(255, 255, 255, 0.55)',
    animate: { x: [0, 36, -40, 0] as number[], y: [0, -24, 16, 0] as number[] },
    duration: 18,
  },
];

/** Soft floating rose orbs behind the full-screen loader. */
export function LoadingBackdrop({ reduced }: { reduced: boolean }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {ORBS.map((orb, index) =>
        reduced ? (
          <div
            key={index}
            className={cn(
              'absolute rounded-full blur-3xl opacity-40',
              orb.className
            )}
            style={{ background: orb.color }}
          />
        ) : (
          <motion.div
            key={index}
            className={cn(
              'absolute rounded-full blur-3xl opacity-50',
              orb.className
            )}
            style={{ background: orb.color }}
            animate={orb.animate}
            transition={{
              duration: orb.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )
      )}
    </div>
  );
}
