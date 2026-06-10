'use client';

import { useEffect, useState } from 'react';
import { HERO_PROMPTS } from '@/content/marketing';
import { SURFACE } from '@/content/productTheme';
import { cn } from '@/lib/cn';

/** Typewriter prompt demo for the landing hero. */
export function PromptDemo({
  dotClassName = 'bg-rose-600',
  cursorClassName = 'bg-rose-600',
}: {
  dotClassName?: string;
  cursorClassName?: string;
}) {
  const [promptIndex, setPromptIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const current = HERO_PROMPTS[promptIndex];

  useEffect(() => {
    const delay = deleting ? 24 : 42;
    const timeout = setTimeout(() => {
      if (!deleting && charIndex < current.length) {
        setCharIndex((c) => c + 1);
        return;
      }
      if (!deleting && charIndex === current.length) {
        setTimeout(() => setDeleting(true), 1800);
        return;
      }
      if (deleting && charIndex > 0) {
        setCharIndex((c) => c - 1);
        return;
      }
      if (deleting && charIndex === 0) {
        setDeleting(false);
        setPromptIndex((i) => (i + 1) % HERO_PROMPTS.length);
      }
    }, delay);
    return () => clearTimeout(timeout);
  }, [charIndex, current.length, deleting, promptIndex]);

  const visible = current.slice(0, charIndex);

  return (
    <div
      className={cn(
        SURFACE.card,
        'p-5 transition-all hover:border-rose-highlight hover:shadow-rose-glass'
      )}
    >
      <div className="flex items-center gap-2 border-b border-[#d2d2d7]/60 pb-3">
        <span className={cn('h-2 w-2 rounded-full', dotClassName)} aria-hidden />
        <span className="text-xs font-medium text-[#86868b]">Your prompt</span>
      </div>
      <div className={cn(SURFACE.input, 'mt-4 min-h-[5rem] rounded-xl px-4 py-3')}>
        <p className="text-[15px] leading-relaxed text-[#1d1d1f]">
          &ldquo;{visible}
          <span
            className={cn(
              'ml-0.5 inline-block h-[1.1em] w-0.5 animate-pulse align-middle',
              cursorClassName
            )}
          />
          &rdquo;
        </p>
      </div>
    </div>
  );
}
