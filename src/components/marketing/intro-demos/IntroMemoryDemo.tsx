'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/components/motion';
import { IntroDemoFrame } from './IntroDemoFrame';
import { useIntroDemoActive } from './useIntroDemoActive';

const MESSAGES = [
  { role: 'user' as const, text: 'We offer emergency plumbing and water heater installs.' },
  { role: 'assistant' as const, text: 'Got it. I will highlight emergency service on the homepage.' },
  { role: 'user' as const, text: 'Our brand voice is friendly and local, not corporate.' },
];

const CONTEXT_PILLS = ['Brand voice', 'Services', 'Goals'] as const;

/** Chat turns stack; context pills accumulate as Auvira learns. */
export function IntroMemoryDemo() {
  const reduced = useReducedMotion();
  const { ref, active } = useIntroDemoActive();
  const [messageCount, setMessageCount] = useState(reduced ? MESSAGES.length : 0);
  const [pillCount, setPillCount] = useState(reduced ? CONTEXT_PILLS.length : 0);
  const [status, setStatus] = useState<'learning' | 'remembers'>(reduced ? 'remembers' : 'learning');

  useEffect(() => {
    if (reduced || !active) return;

    if (messageCount < MESSAGES.length) {
      const t = setTimeout(() => setMessageCount((c) => c + 1), 900);
      return () => clearTimeout(t);
    }

    if (pillCount < CONTEXT_PILLS.length) {
      const t = setTimeout(() => {
        setPillCount((c) => c + 1);
        if (pillCount + 1 === CONTEXT_PILLS.length) setStatus('remembers');
      }, 700);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      setMessageCount(0);
      setPillCount(0);
      setStatus('learning');
    }, 2200);
    return () => clearTimeout(t);
  }, [active, messageCount, pillCount, reduced]);

  useEffect(() => {
    if (!active && !reduced) {
      setMessageCount(0);
      setPillCount(0);
      setStatus('learning');
    }
  }, [active, reduced]);

  return (
    <div ref={ref}>
      <IntroDemoFrame
        label="Animation: Auvira learns context from each conversation"
        header={
          <div className="mb-4 flex items-center justify-between border-b border-[#d2d2d7]/60 pb-3">
            <span className="text-xs font-medium text-[#86868b]">Institutional memory</span>
            <span
              className={cn(
                'text-xs font-semibold transition-colors',
                status === 'remembers' ? 'text-rose-600' : 'text-[#86868b]'
              )}
            >
              {status === 'learning' ? 'Learning…' : 'Remembers'}
            </span>
          </div>
        }
      >
        <div className="space-y-2 min-h-[8rem]">
          <AnimatePresence>
            {MESSAGES.slice(0, messageCount).map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  'max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                  msg.role === 'user'
                    ? 'ml-auto bg-blue-50/80 text-[#1d1d1f] ring-1 ring-blue-200/50'
                    : 'bg-[#f5f5f7] text-[#6e6e73]'
                )}
              >
                {msg.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#d2d2d7]/50 pt-4">
          {CONTEXT_PILLS.slice(0, pillCount).map((pill) => (
            <motion.span
              key={pill}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200/60"
            >
              {pill}
            </motion.span>
          ))}
        </div>
      </IntroDemoFrame>
    </div>
  );
}
