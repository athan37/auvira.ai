'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { NAV_LINKS } from '@/content/marketing';
import { ROSE } from '@/content/marketingTheme';
import { BrandLogo } from './BrandLogo';
import { MarketingLink } from './MarketingLink';
import { APPLE_EASE } from '@/components/motion';

/** Track which landing section is in view for nav highlighting. */
function useLandingSectionSpy(sectionIds: string[]) {
  const [activeId, setActiveId] = useState<string | null>(sectionIds[0] ?? null);

  useEffect(() => {
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-40% 0px -45% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds]);

  return activeId;
}

/** Full-screen mobile navigation sheet. */
export function MobileNav({ activeSection }: { activeSection: string | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-[#1d1d1f] hover:bg-black/5"
      >
        <span className="sr-only">Menu</span>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          )}
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] glass-nav"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: APPLE_EASE }}
          >
            <div className="flex h-16 items-center justify-between px-4">
              <Link href="/intro" onClick={() => setOpen(false)}>
                <BrandLogo />
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/5"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-1 px-6 pt-4">
              {NAV_LINKS.map((link, i) => {
                const sectionId = link.href.replace('#', '');
                const isActive = activeSection === sectionId;
                return (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i, ease: APPLE_EASE }}
                    className={cn(
                      'border-b border-[#d2d2d7]/60 py-4 text-2xl font-semibold text-[#1d1d1f]',
                      isActive && 'border-l-2 border-l-rose-600 pl-3'
                    )}
                  >
                    {link.label}
                  </motion.a>
                );
              })}
              <div className="pt-6">
                <MarketingLink href="/auth/signin" variant="primary" className="w-full justify-center">
                  Sign in
                </MarketingLink>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Sticky glass navigation with scroll shrink. */
export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const sectionIds = NAV_LINKS.map((l) => l.href.replace('#', ''));
  const activeSection = useLandingSectionSpy(sectionIds);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300 ease-apple',
        scrolled ? 'glass-nav shadow-sm' : 'glass-nav border-b border-transparent'
      )}
    >
      <div
        className={cn(
          'mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 transition-all duration-300 sm:px-6 lg:px-8',
          scrolled ? 'h-12' : 'h-16'
        )}
      >
        <Link href="/intro" aria-label="Auvira.ai home">
          <BrandLogo />
        </Link>
        <nav className="hidden items-center gap-2 text-xs font-normal text-[#1d1d1f] sm:flex">
          {NAV_LINKS.map((link) => {
            const sectionId = link.href.replace('#', '');
            const isActive = activeSection === sectionId;
            return (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  'transition-all',
                  isActive
                    ? ROSE.navPill
                    : 'px-3 py-1 opacity-80 hover:opacity-100'
                )}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <MarketingLink href="/auth/signin" variant="ghost" className="hidden sm:inline-flex text-xs">
            Sign in
          </MarketingLink>
          <MobileNav activeSection={activeSection} />
        </div>
      </div>
    </header>
  );
}
