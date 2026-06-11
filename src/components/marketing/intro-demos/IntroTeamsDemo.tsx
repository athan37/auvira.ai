'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import {
  INTRO_DEMO_WHY_BURDEN,
  INTRO_DEMO_WHY_HANDLED,
  INTRO_DEMO_WHY_REPLY,
  INTRO_DEMO_WHY_REQUEST,
} from '@/content/marketing';
import { useReducedMotion } from '@/components/motion';
import { IntroDemoFrame } from './IntroDemoFrame';
import { useIntroDemoActive } from './useIntroDemoActive';
import { useTypewriter } from './useTypewriter';

type Phase = 'burden' | 'request' | 'handled';

/** Hiring burden fades → owner asks in chat → Auvira builds and maintains. */
export function IntroTeamsDemo() {
  const reduced = useReducedMotion();
  const { ref, active } = useIntroDemoActive();
  const [phase, setPhase] = useState<Phase>(reduced ? 'handled' : 'burden');
  const [handledCount, setHandledCount] = useState(
    reduced ? INTRO_DEMO_WHY_HANDLED.length : 0
  );

  useEffect(() => {
    if (reduced || !active) return;

    if (phase === 'burden') {
      const t = setTimeout(() => setPhase('request'), 3600);
      return () => clearTimeout(t);
    }

    if (phase === 'request') {
      return;
    }

    if (phase === 'handled' && handledCount < INTRO_DEMO_WHY_HANDLED.length) {
      const t = setTimeout(() => setHandledCount((c) => c + 1), 850);
      return () => clearTimeout(t);
    }

    if (phase === 'handled' && handledCount === INTRO_DEMO_WHY_HANDLED.length) {
      const t = setTimeout(() => {
        setPhase('burden');
        setHandledCount(0);
      }, 4200);
      return () => clearTimeout(t);
    }
  }, [active, handledCount, phase, reduced]);

  useEffect(() => {
    if (!active && !reduced) {
      setPhase('burden');
      setHandledCount(0);
    }
  }, [active, reduced]);

  const requestVisible = useTypewriter({
    text: INTRO_DEMO_WHY_REQUEST,
    active: active && phase === 'request',
    reduced: reduced || phase !== 'request',
    loop: false,
    holdMs: 1400,
    typeDelay: 48,
  });

  useEffect(() => {
    if (reduced || !active || phase !== 'request') return;
    if (requestVisible.length !== INTRO_DEMO_WHY_REQUEST.length) return;

    const t = setTimeout(() => {
      setPhase('handled');
      setHandledCount(0);
    }, 1800);
    return () => clearTimeout(t);
  }, [active, phase, reduced, requestVisible.length]);

  const showHandled = phase === 'handled' || reduced;

  return (
    <div ref={ref}>
      <IntroDemoFrame
        label="Animation: no developers needed. Describe changes and Auvira builds and maintains your site"
        header={
          <div className="mb-4 flex items-center justify-between border-b border-[#d2d2d7]/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden />
              <span className="text-xs font-medium text-[#86868b]">
                {phase === 'burden' && !reduced
                  ? 'The old way'
                  : phase === 'request' && !reduced
                    ? 'You describe'
                    : 'Auvira handles it'}
              </span>
            </div>
            {showHandled && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                Full control · No dev
              </span>
            )}
          </div>
        }
      >
        <div className="min-h-[8.5rem]">
          <AnimatePresence mode="wait">
            {phase === 'burden' && !reduced ? (
              <motion.div
                key="burden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.5 }}
              >
                <p className="mb-3 text-xs text-[#86868b]">Hiring teams to build and maintain</p>
                <div className="flex flex-wrap gap-2">
                  {INTRO_DEMO_WHY_BURDEN.map((label, i) => (
                    <motion.span
                      key={label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: i * 0.15, duration: 0.45 }}
                      className="rounded-full bg-[#f5f5f7] px-3 py-1.5 text-xs font-medium text-[#6e6e73] ring-1 ring-[#d2d2d7]/80"
                    >
                      {label}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            ) : phase === 'request' && !reduced ? (
              <motion.div
                key="request"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-[#86868b]">
                  Website owner
                </p>
                <div className="rounded-2xl bg-blue-50/80 px-4 py-3 ring-1 ring-blue-200/60">
                  <p className="text-[15px] leading-relaxed text-[#1d1d1f]">
                    &ldquo;{requestVisible}
                    <span className="ml-0.5 inline-block h-[1.1em] w-0.5 animate-pulse bg-rose-500 align-middle" />
                    &rdquo;
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="handled"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="rounded-2xl bg-rose-50/60 px-4 py-3 ring-1 ring-rose-200/50">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-rose-700">
                    Auvira
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[#1d1d1f]">
                    {INTRO_DEMO_WHY_REPLY}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {INTRO_DEMO_WHY_HANDLED.slice(0, handledCount).map((item) => (
                    <motion.div
                      key={item}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 text-xs text-[#1d1d1f]"
                    >
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white"
                        aria-hidden
                      >
                        ✓
                      </span>
                      {item}
                    </motion.div>
                  ))}
                </div>
                <p className={cn('text-xs text-[#6e6e73]', handledCount < 3 && !reduced && 'opacity-0')}>
                  You stay in control. Zero technical upkeep.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </IntroDemoFrame>
    </div>
  );
}
