'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { AuviraLogoMark } from '@/components/marketing/AuviraLogoMark';
import { cn } from '@/lib/cn';
import { LOADING } from '@/content/productTheme';
import { APPLE_EASE, useReducedMotion } from '@/components/motion/tokens';
import { LoadingDots } from './LoadingDots';

/** Full-viewport loader — brand, message, and indeterminate progress bar. */
export function LoadingShell({
  message = 'Loading…',
  fullScreen = true,
  showBrand = true,
  className,
}: {
  message?: string;
  fullScreen?: boolean;
  showBrand?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [portalReady, setPortalReady] = useState(false);
  const displayMessage = message.replace(/\s*\.{1,3}\s*$/, '').trimEnd();

  useLayoutEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!fullScreen || !portalReady) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullScreen, portalReady]);

  const shell = (
    <div
      className={cn(
        'flex flex-col items-center justify-center overflow-hidden',
        LOADING.shell,
        fullScreen ? 'fixed inset-0 z-[9999]' : 'relative min-h-[50vh] w-full',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <motion.div
        className="flex flex-col items-center gap-4 px-6 text-center max-w-sm"
        initial={{
          opacity: reduced ? 1 : 0,
          y: reduced ? 0 : 8,
        }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduced ? 0 : 0.4,
          ease: APPLE_EASE,
        }}
      >
        {showBrand && <AuviraLogoMark size="lg" />}
        <LoadingDots size="lg" />
        <p className="text-[17px] font-medium text-[#1d1d1f]">
          {displayMessage}
          <span className={LOADING.heroEllipsis} aria-hidden />
        </p>
        <div className={cn(LOADING.progressTrack, 'w-56')} aria-hidden>
          <div className={LOADING.progressShimmer} />
        </div>
      </motion.div>
    </div>
  );

  if (fullScreen && portalReady) {
    return createPortal(shell, document.body);
  }

  return shell;
}
