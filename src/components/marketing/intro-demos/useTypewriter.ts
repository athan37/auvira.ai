'use client';

import { useEffect, useState } from 'react';

type UseTypewriterOptions = {
  text: string;
  active: boolean;
  reduced: boolean;
  typeDelay?: number;
  deleteDelay?: number;
  holdMs?: number;
  loop?: boolean;
};

/** Character-by-character typewriter with optional delete + loop. */
export function useTypewriter({
  text,
  active,
  reduced,
  typeDelay = 42,
  deleteDelay = 24,
  holdMs = 1800,
  loop = true,
}: UseTypewriterOptions) {
  const [charIndex, setCharIndex] = useState(reduced ? text.length : 0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (reduced) {
      setCharIndex(text.length);
      setDeleting(false);
      return;
    }
    if (!active) return;

    const delay = deleting ? deleteDelay : typeDelay;
    const timeout = setTimeout(() => {
      if (!deleting && charIndex < text.length) {
        setCharIndex((c) => c + 1);
        return;
      }
      if (!deleting && charIndex === text.length) {
        if (loop) {
          setTimeout(() => setDeleting(true), holdMs);
        }
        return;
      }
      if (deleting && charIndex > 0) {
        setCharIndex((c) => c - 1);
        return;
      }
      if (deleting && charIndex === 0) {
        setDeleting(false);
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [
    active,
    charIndex,
    deleteDelay,
    deleting,
    holdMs,
    loop,
    reduced,
    text.length,
    typeDelay,
  ]);

  useEffect(() => {
    if (!active && !reduced) {
      setCharIndex(0);
      setDeleting(false);
    }
  }, [active, reduced]);

  return text.slice(0, charIndex);
}
