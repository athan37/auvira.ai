'use client';

import { useEffect, useState } from 'react';
import { HERO_PROMPTS } from '@/content/marketing';

/** Typewriter prompt demo for the landing hero. */
export function PromptDemo() {
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
    <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white/80 p-5 shadow-glass backdrop-blur-sm transition-all hover:border-rose-highlight hover:shadow-rose-glass">
      <div className="flex items-center gap-2 border-b border-[#d2d2d7]/60 pb-3">
        <span className="h-2 w-2 rounded-full bg-rose-600" aria-hidden />
        <span className="text-xs font-medium text-[#86868b]">Your prompt</span>
      </div>
      <div className="mt-4 min-h-[5rem] rounded-xl bg-[#f5f5f7] px-4 py-3">
        <p className="text-[15px] leading-relaxed text-[#1d1d1f]">
          &ldquo;{visible}
          <span className="ml-0.5 inline-block h-[1.1em] w-0.5 animate-pulse bg-rose-600 align-middle" />
          &rdquo;
        </p>
      </div>
    </div>
  );
}
