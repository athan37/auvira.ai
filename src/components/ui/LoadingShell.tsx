'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { BRAND } from '@/content/marketing';
import { SURFACE, LOADING } from '@/content/productTheme';
import { ROSE } from '@/content/marketingTheme';
import { APPLE_EASE, useReducedMotion } from '@/components/motion/tokens';
import { RoseOrbitSvg } from './RoseOrbitSvg';
import { LoadingBackdrop } from './LoadingBackdrop';

/** Full-viewport loader — floating orbs + dual SVG rings + copy. */
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
        SURFACE.canvas,
        fullScreen ? 'fixed inset-0 z-[9999]' : 'relative min-h-[50vh] w-full',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <LoadingBackdrop reduced={reduced} />

      <div
        className={cn(
          'pointer-events-none absolute inset-0 opacity-[0.12]',
          ROSE.glowSoft
        )}
        aria-hidden
      />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6">
        <motion.div
          initial={{
            opacity: reduced ? 1 : 0,
            scale: reduced ? 1 : 0.92,
          }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: reduced ? 0 : 0.5,
            ease: APPLE_EASE,
          }}
        >
          <RoseOrbitSvg size={128} reduced={reduced} />
        </motion.div>

        <motion.div
          className="flex flex-col items-center gap-4 text-center"
          initial={{
            opacity: reduced ? 1 : 0,
            y: reduced ? 0 : 10,
          }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? 0 : 0.45,
            delay: reduced ? 0 : 0.12,
            ease: APPLE_EASE,
          }}
        >
          {showBrand && (
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#86868b]">
              {BRAND.name}
            </p>
          )}
          <p className="text-[17px] font-medium text-[#1d1d1f] max-w-xs">
            {displayMessage}
            <span className={LOADING.heroEllipsis} aria-hidden />
          </p>
          <div className={LOADING.progressTrack} aria-hidden>
            <div className={LOADING.progressShimmer} />
          </div>
        </motion.div>
      </div>
    </div>
  );

  if (fullScreen && portalReady) {
    return createPortal(shell, document.body);
  }

  return shell;
}
