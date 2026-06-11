'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { INTRO_DEMO_PROMPT } from '@/content/marketing';
import { SURFACE } from '@/content/productTheme';
import { useReducedMotion } from '@/components/motion';
import { IntroDemoFrame } from './IntroDemoFrame';
import { useIntroDemoActive } from './useIntroDemoActive';
import { useTypewriter } from './useTypewriter';

type Phase = 'prompt' | 'voice';

const WAVEFORM_BARS = [0.35, 0.7, 0.5, 0.9, 0.45] as const;

/** Cycles typewriter prompt → voice waveform + transcript. */
export function IntroDescribeDemo({
  dotClassName = 'bg-rose-700',
  cursorClassName = 'bg-rose-700',
}: {
  dotClassName?: string;
  cursorClassName?: string;
}) {
  const reduced = useReducedMotion();
  const { ref, active } = useIntroDemoActive();
  const [phase, setPhase] = useState<Phase>(reduced ? 'voice' : 'prompt');

  const promptVisible = useTypewriter({
    text: INTRO_DEMO_PROMPT,
    active: active && phase === 'prompt',
    reduced: reduced || phase !== 'prompt',
    loop: false,
    holdMs: 1200,
  });

  const voiceVisible = useTypewriter({
    text: INTRO_DEMO_PROMPT,
    active: active && phase === 'voice',
    reduced,
    loop: false,
    holdMs: 2000,
    typeDelay: 36,
  });

  useEffect(() => {
    if (reduced || !active) return;

    if (phase === 'prompt' && promptVisible.length === INTRO_DEMO_PROMPT.length) {
      const t = setTimeout(() => setPhase('voice'), 1400);
      return () => clearTimeout(t);
    }

    if (phase === 'voice' && voiceVisible.length === INTRO_DEMO_PROMPT.length) {
      const t = setTimeout(() => setPhase('prompt'), 2400);
      return () => clearTimeout(t);
    }
  }, [active, phase, promptVisible.length, reduced, voiceVisible.length]);

  useEffect(() => {
    if (!active && !reduced) setPhase('prompt');
  }, [active, reduced]);

  return (
    <div ref={ref}>
      <IntroDemoFrame
        label="Animation: describe your business by typing or speaking"
        header={
          <div className="mb-4 flex items-center gap-2 border-b border-[#d2d2d7]/60 pb-3">
            <span className={cn('h-2 w-2 rounded-full', dotClassName)} aria-hidden />
            <span className="text-xs font-medium text-[#86868b]">
              {phase === 'prompt' ? 'Type your prompt' : 'Speak your prompt'}
            </span>
          </div>
        }
      >
        <AnimatePresence mode="wait">
          {phase === 'prompt' && !reduced ? (
            <motion.div
              key="prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(SURFACE.input, 'min-h-[5.5rem] rounded-xl px-4 py-3')}
            >
              <p className="text-[15px] leading-relaxed text-[#1d1d1f]">
                &ldquo;{promptVisible}
                <span
                  className={cn(
                    'ml-0.5 inline-block h-[1.1em] w-0.5 animate-pulse align-middle',
                    cursorClassName
                  )}
                />
                &rdquo;
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="voice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm',
                    active && !reduced && 'animate-pulse'
                  )}
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
                  </svg>
                </button>
                <div className="flex flex-1 items-end justify-center gap-1 h-10">
                  {WAVEFORM_BARS.map((h, i) => (
                    <motion.span
                      key={i}
                      className="w-1 rounded-full bg-rose-500/70"
                      animate={
                        active && !reduced
                          ? { height: [`${h * 40}%`, `${(1 - h) * 50 + 20}%`, `${h * 40}%`] }
                          : { height: `${h * 40}%` }
                      }
                      transition={{
                        duration: 0.55,
                        repeat: active && !reduced ? Infinity : 0,
                        delay: i * 0.08,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className={cn(SURFACE.input, 'rounded-xl px-4 py-3')}>
                <p className="text-[15px] leading-relaxed text-[#1d1d1f]">
                  &ldquo;{reduced ? INTRO_DEMO_PROMPT : voiceVisible}
                  {!reduced && (
                    <span
                      className={cn(
                        'ml-0.5 inline-block h-[1.1em] w-0.5 animate-pulse align-middle',
                        cursorClassName
                      )}
                    />
                  )}
                  &rdquo;
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </IntroDemoFrame>
    </div>
  );
}
