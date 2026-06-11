'use client';

import { cn } from '@/lib/cn';
import { INTRO_DEMO_PROMPT } from '@/content/marketing';
import { SURFACE } from '@/content/productTheme';
import { useReducedMotion } from '@/components/motion';
import { IntroDemoFrame } from './intro-demos/IntroDemoFrame';
import { useIntroDemoActive } from './intro-demos/useIntroDemoActive';
import { useTypewriter } from './intro-demos/useTypewriter';

/** Typewriter prompt demo (legacy landing widget). */
export function PromptDemo({
  dotClassName = 'bg-rose-600',
  cursorClassName = 'bg-rose-600',
}: {
  dotClassName?: string;
  cursorClassName?: string;
}) {
  const reduced = useReducedMotion();
  const { ref, active } = useIntroDemoActive();
  const visible = useTypewriter({
    text: INTRO_DEMO_PROMPT,
    active,
    reduced,
    loop: true,
  });

  return (
    <div ref={ref}>
      <IntroDemoFrame
        label="Animation: type a business description prompt"
        header={
          <div className="mb-4 flex items-center gap-2 border-b border-[#d2d2d7]/60 pb-3">
            <span className={cn('h-2 w-2 rounded-full', dotClassName)} aria-hidden />
            <span className="text-xs font-medium text-[#86868b]">Your prompt</span>
          </div>
        }
      >
        <div className={cn(SURFACE.input, 'min-h-[5rem] rounded-xl px-4 py-3')}>
          <p className="text-[15px] leading-relaxed text-[#1d1d1f]">
            &ldquo;{visible}
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
      </IntroDemoFrame>
    </div>
  );
}
