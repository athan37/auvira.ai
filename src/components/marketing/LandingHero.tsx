'use client';

import { StaggerChildren, StaggerItem } from '@/components/motion';
import { HERO } from '@/content/marketing';
import { IntroSection } from './IntroSection';
import { MarketingLink } from './MarketingLink';

/** Hero section with staggered entrance animations. */
export function LandingHero() {
  return (
    <IntroSection
      accentId="hero"
      noPadding
      className="overflow-hidden pt-8 pb-16 lg:pt-16 lg:pb-24"
      innerClassName="max-w-[980px]"
    >
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
      </StaggerChildren>
    </IntroSection>
  );
}
