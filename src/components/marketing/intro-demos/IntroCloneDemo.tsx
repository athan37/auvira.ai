'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import {
  INTRO_DEMO_CLONE_PRESERVED,
  INTRO_DEMO_CLONE_STEPS,
  INTRO_DEMO_CLONE_URL,
} from '@/content/marketing';
import { SURFACE } from '@/content/productTheme';
import { useReducedMotion } from '@/components/motion';
import { IntroDemoFrame } from './IntroDemoFrame';
import { useIntroDemoActive } from './useIntroDemoActive';
import { useTypewriter } from './useTypewriter';

type Phase = 'url' | 'crawl' | 'preserved';

/** URL paste → crawl steps → preserved content chips + modernized preview hint. */
export function IntroCloneDemo() {
  const reduced = useReducedMotion();
  const { ref, active } = useIntroDemoActive();
  const [phase, setPhase] = useState<Phase>(reduced ? 'preserved' : 'url');
  const [stepIndex, setStepIndex] = useState(reduced ? INTRO_DEMO_CLONE_STEPS.length : 0);
  const [pillCount, setPillCount] = useState(reduced ? INTRO_DEMO_CLONE_PRESERVED.length : 0);

  const urlVisible = useTypewriter({
    text: INTRO_DEMO_CLONE_URL,
    active: active && phase === 'url',
    reduced: reduced || phase !== 'url',
    loop: false,
    holdMs: 1000,
    typeDelay: 28,
  });

  useEffect(() => {
    if (reduced || !active) return;

    if (phase === 'url' && urlVisible.length === INTRO_DEMO_CLONE_URL.length) {
      const t = setTimeout(() => {
        setPhase('crawl');
        setStepIndex(0);
      }, 1200);
      return () => clearTimeout(t);
    }

    if (phase === 'crawl' && stepIndex < INTRO_DEMO_CLONE_STEPS.length) {
      const t = setTimeout(() => setStepIndex((i) => i + 1), 750);
      return () => clearTimeout(t);
    }

    if (phase === 'crawl' && stepIndex === INTRO_DEMO_CLONE_STEPS.length) {
      const t = setTimeout(() => {
        setPhase('preserved');
        setPillCount(0);
      }, 500);
      return () => clearTimeout(t);
    }

    if (phase === 'preserved' && pillCount < INTRO_DEMO_CLONE_PRESERVED.length) {
      const t = setTimeout(() => setPillCount((c) => c + 1), 450);
      return () => clearTimeout(t);
    }

    if (phase === 'preserved' && pillCount === INTRO_DEMO_CLONE_PRESERVED.length) {
      const t = setTimeout(() => {
        setPhase('url');
        setStepIndex(0);
        setPillCount(0);
      }, 2400);
      return () => clearTimeout(t);
    }
  }, [active, phase, pillCount, reduced, stepIndex, urlVisible.length]);

  useEffect(() => {
    if (!active && !reduced) {
      setPhase('url');
      setStepIndex(0);
      setPillCount(0);
    }
  }, [active, reduced]);

  return (
    <div ref={ref}>
      <IntroDemoFrame
        label="Animation: paste a URL, crawl existing site, preserve content, rebuild draft"
        header={
          <div className="mb-4 flex items-center gap-2 border-b border-[#d2d2d7]/60 pb-3">
            <span className="h-2 w-2 rounded-full bg-rose-accent" aria-hidden />
            <span className="text-xs font-medium text-[#86868b]">Refresh from URL</span>
          </div>
        }
      >
        <AnimatePresence mode="wait">
          {phase === 'url' && !reduced ? (
            <motion.div
              key="url"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <label className="text-xs font-medium text-[#86868b]">Website URL</label>
              <div className={cn(SURFACE.input, 'mt-2 rounded-xl px-4 py-3 font-mono text-sm')}>
                <span className="text-[#1d1d1f]">
                  {urlVisible}
                  <span className="ml-0.5 inline-block h-[1.1em] w-0.5 animate-pulse bg-rose-accent align-middle" />
                </span>
              </div>
            </motion.div>
          ) : phase === 'crawl' && !reduced ? (
            <motion.div
              key="crawl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {INTRO_DEMO_CLONE_STEPS.map((step, i) => {
                const done = i < stepIndex;
                const current = i === stepIndex;
                return (
                  <div
                    key={step}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                      done ? 'bg-blue-50/60 text-[#1d1d1f]' : 'text-[#6e6e73]'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]',
                        done
                          ? 'bg-blue-600 text-white'
                          : current
                            ? 'border-2 border-blue-400 border-t-transparent animate-spin'
                            : 'bg-[#f5f5f7] ring-1 ring-[#d2d2d7]/80'
                      )}
                      aria-hidden
                    >
                      {done ? '✓' : current ? '' : '·'}
                    </span>
                    {step}
                  </div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="preserved"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <p className="text-xs font-semibold text-rose-700">Content preserved</p>
              <div className="flex flex-wrap gap-2">
                {INTRO_DEMO_CLONE_PRESERVED.slice(0, pillCount).map((pill) => (
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
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-xl border border-[#d2d2d7]/60 bg-[#ebebed] p-3 opacity-70">
                  <p className="text-[10px] uppercase tracking-wide text-[#86868b]">Before</p>
                  <div className="mt-2 space-y-2">
                    <div className="h-2 w-full rounded bg-[#d2d2d7]/80" />
                    <div className="h-2 w-4/5 rounded bg-[#d2d2d7]/60" />
                    <div className="h-2 w-3/5 rounded bg-[#d2d2d7]/50" />
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200/60 bg-blue-50/40 p-3 ring-1 ring-blue-100">
                  <p className="text-[10px] uppercase tracking-wide text-blue-700">Modern draft</p>
                  <div className="mt-2 space-y-2">
                    <div className="h-2 w-full rounded bg-blue-300/50" />
                    <div className="h-2 w-4/5 rounded bg-blue-200/40" />
                    <div className="h-2 w-3/5 rounded bg-blue-200/30" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </IntroDemoFrame>
    </div>
  );
}
