'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import {
  INTRO_DEMO_DESCRIBE_CHIPS,
  INTRO_DEMO_DESCRIBE_SECTIONS,
  INTRO_DEMO_PROMPT,
} from '@/content/marketing';
import { useReducedMotion } from '@/components/motion';
import { IntroDemoFrame } from './IntroDemoFrame';
import { useIntroDemoActive } from './useIntroDemoActive';

type Phase = 'chips' | 'build';

/** Plays once: prompt chips → site wireframe build, then holds the final frame. */
export function IntroDescribeDemo({
  dotClassName = 'bg-rose-700',
}: {
  dotClassName?: string;
  cursorClassName?: string;
}) {
  const reduced = useReducedMotion();
  const { ref, active } = useIntroDemoActive();
  const [phase, setPhase] = useState<Phase>(reduced ? 'build' : 'chips');
  const [chipIndex, setChipIndex] = useState(reduced ? INTRO_DEMO_DESCRIBE_CHIPS.length : 0);
  const [sectionCount, setSectionCount] = useState(
    reduced ? INTRO_DEMO_DESCRIBE_SECTIONS.length : 0
  );
  const [showAssembled, setShowAssembled] = useState(reduced);
  const [finished, setFinished] = useState(reduced);

  useEffect(() => {
    if (reduced || !active || finished) return;

    if (phase === 'chips') {
      if (chipIndex < INTRO_DEMO_DESCRIBE_CHIPS.length) {
        const t = setTimeout(() => setChipIndex((i) => i + 1), 650);
        return () => clearTimeout(t);
      }
      if (!showAssembled) {
        const t = setTimeout(() => setShowAssembled(true), 400);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => {
        setPhase('build');
        setSectionCount(0);
      }, 1100);
      return () => clearTimeout(t);
    }

    if (phase === 'build' && sectionCount < INTRO_DEMO_DESCRIBE_SECTIONS.length) {
      const t = setTimeout(() => setSectionCount((c) => c + 1), 550);
      return () => clearTimeout(t);
    }

    if (phase === 'build' && sectionCount === INTRO_DEMO_DESCRIBE_SECTIONS.length) {
      setFinished(true);
    }
  }, [active, chipIndex, finished, phase, reduced, sectionCount, showAssembled]);

  useEffect(() => {
    if (!active && !reduced && !finished) {
      setPhase('chips');
      setChipIndex(0);
      setSectionCount(0);
      setShowAssembled(false);
    }
  }, [active, finished, reduced]);

  const headerLabel = finished
    ? 'Draft ready from your description'
    : phase === 'chips'
      ? 'Pick what to include'
      : 'Site builds from your description';

  return (
    <div ref={ref}>
      <IntroDemoFrame
        label="Animation: describe your business with chips and watch the site build"
        header={
          <div className="mb-4 flex items-center gap-2 border-b border-[#d2d2d7]/60 pb-3">
            <span className={cn('h-2 w-2 rounded-full', dotClassName)} aria-hidden />
            <span className="text-xs font-medium text-[#86868b]">{headerLabel}</span>
          </div>
        }
      >
        <AnimatePresence mode="wait">
          {phase === 'chips' && !reduced ? (
            <motion.div
              key="chips"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <p className="text-xs font-medium text-[#86868b]">Describe your business</p>
              <div className="flex flex-wrap gap-2">
                {INTRO_DEMO_DESCRIBE_CHIPS.map((chip, i) => {
                  const selected = i < chipIndex;
                  return (
                    <motion.span
                      key={chip}
                      animate={
                        selected
                          ? { scale: [1, 1.04, 1], boxShadow: '0 0 0 2px rgba(190, 24, 93, 0.35)' }
                          : { scale: 1, boxShadow: '0 0 0 0px transparent' }
                      }
                      transition={{ duration: 0.35 }}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors',
                        selected
                          ? 'bg-rose-50 text-rose-800 ring-rose-200/80'
                          : 'bg-[#f5f5f7] text-[#6e6e73] ring-[#d2d2d7]/80'
                      )}
                    >
                      {chip}
                    </motion.span>
                  );
                })}
              </div>
              <AnimatePresence>
                {showAssembled ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl rounded-tl-md bg-blue-600/90 px-4 py-3 text-white shadow-sm"
                  >
                    <p className="text-[14px] leading-relaxed">&ldquo;{INTRO_DEMO_PROMPT}&rdquo;</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="build"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="rounded-xl border border-[#d2d2d7]/60 bg-[#fafafa] p-3">
                <div className="mb-3 flex items-center gap-2 border-b border-[#d2d2d7]/50 pb-2">
                  <div className="h-2 w-2 rounded-full bg-[#d2d2d7]" />
                  <div className="h-2 w-2 rounded-full bg-[#d2d2d7]" />
                  <div className="h-2 w-2 rounded-full bg-[#d2d2d7]" />
                  <span className="ml-2 text-[10px] text-[#86868b]">your-site.auvira.app</span>
                </div>
                <div className="space-y-2">
                  {INTRO_DEMO_DESCRIBE_SECTIONS.slice(0, sectionCount).map((section, i) => (
                    <motion.div
                      key={section}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.35 }}
                      className={cn(
                        'overflow-hidden rounded-lg px-3 py-2.5 text-[11px] font-medium',
                        i === 1
                          ? 'bg-rose-100/80 text-rose-800'
                          : i === 3
                            ? 'bg-blue-50 text-blue-800'
                            : 'bg-white text-[#6e6e73] ring-1 ring-[#d2d2d7]/60'
                      )}
                    >
                      <span className="text-[10px] uppercase tracking-wide text-[#86868b]">
                        {section}
                      </span>
                      <div className="mt-1.5 space-y-1">
                        <div
                          className={cn(
                            'h-1.5 rounded',
                            i === 1 ? 'w-4/5 bg-rose-300/60' : 'w-full bg-[#d2d2d7]/70'
                          )}
                        />
                        <div className="h-1.5 w-3/5 rounded bg-[#d2d2d7]/50" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
              {sectionCount === INTRO_DEMO_DESCRIBE_SECTIONS.length ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-xs font-medium text-rose-700"
                >
                  Draft ready from your description
                </motion.p>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </IntroDemoFrame>
    </div>
  );
}
