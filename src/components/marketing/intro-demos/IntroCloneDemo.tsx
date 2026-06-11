'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import {
  INTRO_DEMO_CLONE_PRESERVED,
  INTRO_DEMO_CLONE_STEPS,
  INTRO_DEMO_CLONE_URL,
} from '@/content/marketing';
import { useReducedMotion } from '@/components/motion';
import { IntroDemoFrame } from './IntroDemoFrame';
import { useIntroDemoActive } from './useIntroDemoActive';

type Phase = 'paste' | 'crawl' | 'preserved';

/** Browser paste → horizontal crawl pipeline → preserved content + before/after preview. */
export function IntroCloneDemo() {
  const reduced = useReducedMotion();
  const { ref, active } = useIntroDemoActive();
  const [phase, setPhase] = useState<Phase>(reduced ? 'preserved' : 'paste');
  const [urlVisible, setUrlVisible] = useState(reduced);
  const [stepIndex, setStepIndex] = useState(reduced ? INTRO_DEMO_CLONE_STEPS.length : 0);
  const [pillCount, setPillCount] = useState(reduced ? INTRO_DEMO_CLONE_PRESERVED.length : 0);
  const [scanLine, setScanLine] = useState(false);

  useEffect(() => {
    if (reduced || !active) return;

    if (phase === 'paste' && !urlVisible) {
      const t = setTimeout(() => setUrlVisible(true), 500);
      return () => clearTimeout(t);
    }

    if (phase === 'paste' && urlVisible) {
      const t = setTimeout(() => {
        setPhase('crawl');
        setStepIndex(0);
        setScanLine(true);
      }, 1400);
      return () => clearTimeout(t);
    }

    if (phase === 'crawl' && stepIndex < INTRO_DEMO_CLONE_STEPS.length) {
      const t = setTimeout(() => setStepIndex((i) => i + 1), 900);
      return () => clearTimeout(t);
    }

    if (phase === 'crawl' && stepIndex === INTRO_DEMO_CLONE_STEPS.length) {
      const t = setTimeout(() => {
        setPhase('preserved');
        setPillCount(0);
        setScanLine(false);
      }, 600);
      return () => clearTimeout(t);
    }

    if (phase === 'preserved' && pillCount < INTRO_DEMO_CLONE_PRESERVED.length) {
      const t = setTimeout(() => setPillCount((c) => c + 1), 450);
      return () => clearTimeout(t);
    }

    if (phase === 'preserved' && pillCount === INTRO_DEMO_CLONE_PRESERVED.length) {
      const t = setTimeout(() => {
        setPhase('paste');
        setUrlVisible(false);
        setStepIndex(0);
        setPillCount(0);
      }, 2600);
      return () => clearTimeout(t);
    }
  }, [active, phase, pillCount, reduced, stepIndex, urlVisible]);

  useEffect(() => {
    if (!active && !reduced) {
      setPhase('paste');
      setUrlVisible(false);
      setStepIndex(0);
      setPillCount(0);
      setScanLine(false);
    }
  }, [active, reduced]);

  const displayUrl = INTRO_DEMO_CLONE_URL.replace(/^https?:\/\//, '');

  return (
    <div ref={ref}>
      <IntroDemoFrame
        label="Animation: paste a URL in the browser, crawl existing site, preserve content, rebuild draft"
        className="overflow-hidden"
        header={
          <div className="mb-4 flex items-center gap-2 border-b border-[#d2d2d7]/60 pb-3">
            <span className="h-2 w-2 rounded-full bg-rose-accent" aria-hidden />
            <span className="text-xs font-medium text-[#86868b]">
              {phase === 'paste'
                ? 'Paste your existing URL'
                : phase === 'crawl'
                  ? 'Crawling your site'
                  : 'Content preserved'}
            </span>
          </div>
        }
      >
        <AnimatePresence mode="wait">
          {phase === 'paste' && !reduced ? (
            <motion.div
              key="paste"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="overflow-hidden rounded-xl border border-[#d2d2d7]/70 bg-[#f5f5f7] shadow-inner">
                <div className="flex items-center gap-2 border-b border-[#d2d2d7]/60 bg-white px-3 py-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" aria-hidden />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" aria-hidden />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" aria-hidden />
                </div>
                <div className="flex items-center gap-2 px-3 py-3">
                  <span className="text-[#86868b]" aria-hidden>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </span>
                  <div
                    className={cn(
                      'flex flex-1 items-center rounded-lg bg-white px-3 py-2 ring-1 transition-all',
                      urlVisible ? 'ring-blue-300/80 shadow-sm' : 'ring-[#d2d2d7]/80'
                    )}
                  >
                    <AnimatePresence>
                      {urlVisible ? (
                        <motion.span
                          key="url"
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="font-mono text-sm text-[#1d1d1f]"
                        >
                          {displayUrl}
                        </motion.span>
                      ) : (
                        <motion.span
                          key="placeholder"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-sm text-[#86868b]"
                        >
                          Paste URL here…
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <motion.span
                    animate={urlVisible ? { scale: [1, 1.08, 1] } : {}}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Go
                  </motion.span>
                </div>
              </div>
              {urlVisible ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-xs text-[#6e6e73]"
                >
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700 ring-1 ring-blue-200/60">
                    ⌘V
                  </span>
                  URL pasted from clipboard
                </motion.p>
              ) : null}
            </motion.div>
          ) : phase === 'crawl' && !reduced ? (
            <motion.div
              key="crawl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <div className="relative overflow-hidden rounded-xl border border-[#d2d2d7]/60 bg-[#ebebed] p-4">
                <div className="space-y-2 opacity-60">
                  <div className="h-2 w-full rounded bg-[#d2d2d7]/80" />
                  <div className="h-2 w-4/5 rounded bg-[#d2d2d7]/60" />
                  <div className="h-2 w-3/5 rounded bg-[#d2d2d7]/50" />
                </div>
                {scanLine ? (
                  <motion.div
                    className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
                    animate={{ top: ['0%', '100%'] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                  />
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-1 px-1">
                {INTRO_DEMO_CLONE_STEPS.map((step, i) => {
                  const done = i < stepIndex;
                  const current = i === stepIndex;
                  return (
                    <div key={step} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex w-full items-center">
                        {i > 0 ? (
                          <div
                            className={cn(
                              'h-0.5 flex-1 transition-colors',
                              done || current ? 'bg-blue-400' : 'bg-[#d2d2d7]/80'
                            )}
                          />
                        ) : (
                          <div className="flex-1" />
                        )}
                        <span
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                            done
                              ? 'bg-blue-600 text-white'
                              : current
                                ? 'border-2 border-blue-400 border-t-transparent animate-spin text-transparent'
                                : 'bg-[#f5f5f7] text-[#86868b] ring-1 ring-[#d2d2d7]/80'
                          )}
                          aria-hidden
                        >
                          {done ? '✓' : i + 1}
                        </span>
                        {i < INTRO_DEMO_CLONE_STEPS.length - 1 ? (
                          <div
                            className={cn(
                              'h-0.5 flex-1 transition-colors',
                              done ? 'bg-blue-400' : 'bg-[#d2d2d7]/80'
                            )}
                          />
                        ) : (
                          <div className="flex-1" />
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-center text-[10px] font-medium leading-tight',
                          done || current ? 'text-[#1d1d1f]' : 'text-[#86868b]'
                        )}
                      >
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
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
