'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { HERO } from '@/content/marketing';
import { ROSE } from '@/content/marketingTheme';
import { StaggerChildren, StaggerItem } from '@/components/motion';
import { MarketingLink } from './MarketingLink';
import { ProductMock } from './ProductMock';

/** Hero section with staggered entrance animations. */
export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-16 lg:pb-24">
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem]',
          ROSE.atmosphereHero
        )}
        aria-hidden
      />
      <div className="mx-auto max-w-[980px] px-4 sm:px-6">
        <StaggerChildren className="flex flex-col items-center text-center">
          <StaggerItem>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.04em] leading-[1.05] text-[#1d1d1f] sm:text-6xl lg:text-[4.5rem] text-balance">
              {HERO.headline}
            </h1>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-6 max-w-xl text-[17px] leading-[1.47] text-[#6e6e73]">
              {HERO.subline}
            </p>
          </StaggerItem>
          <StaggerItem>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <MarketingLink href="/auth/signin" variant="primary">
                {HERO.primaryCta}
              </MarketingLink>
              <MarketingLink href={HERO.secondaryHref} variant="secondary">
                {HERO.secondaryCta}
              </MarketingLink>
            </div>
          </StaggerItem>
          <StaggerItem className="mt-16 w-full">
            <ProductMock />
          </StaggerItem>
        </StaggerChildren>
      </div>
    </section>
  );
}

/** Final CTA band with hover scale on primary button. */
export function LandingFinalCta({
  headline,
  subline,
  cta,
}: {
  headline: string;
  subline: string;
  cta: string;
}) {
  return (
    <section className="relative overflow-hidden bg-[#f5f5f7] py-20 lg:py-28">
      <div
        className={cn('pointer-events-none absolute inset-0', ROSE.atmosphereFinal)}
        aria-hidden
      />
      <div className="relative mx-auto max-w-[980px] px-4 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#1d1d1f] sm:text-4xl lg:text-5xl">
          {headline}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[17px] leading-[1.47] text-[#6e6e73]">
          {subline}
        </p>
        <motion.div className="mt-8" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <MarketingLink href="/auth/signin" variant="primary" size="lg" className="inline-flex">
            {cta}
          </MarketingLink>
        </motion.div>
      </div>
    </section>
  );
}
