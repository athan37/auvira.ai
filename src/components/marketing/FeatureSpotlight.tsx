'use client';

import { ScrollReveal, PromoGlassReveal } from '@/components/motion';
import { cn } from '@/lib/cn';
import { FEATURE_SPOTLIGHTS } from '@/content/marketing';
import { INTRO_ACCENTS, ROSE } from '@/content/marketingTheme';
import { SURFACE } from '@/content/productTheme';
import { IntroSection } from './IntroSection';
import { MarketingTextLink } from './MarketingLink';
import { ProductMock } from './ProductMock';
import { PromptDemo } from './PromptDemo';

type Spotlight = (typeof FEATURE_SPOTLIGHTS)[number];

function FeatureVisual({
  id,
  accent,
}: {
  id: Spotlight['id'];
  accent: (typeof INTRO_ACCENTS)[Spotlight['id']];
}) {
  if (id === 'describe') {
    return <PromptDemo dotClassName={accent.dot} cursorClassName={accent.cursor} />;
  }

  if (id === 'preview') {
    return (
      <PromoGlassReveal>
        <div className={cn(ROSE.glassPremium, 'rounded-3xl p-3 sm:p-4')}>
          <ProductMock variant="glass" animateEntrance={false} />
        </div>
      </PromoGlassReveal>
    );
  }

  if (id === 'edit') {
    return <ProductMock />;
  }

  return (
    <div className={cn(SURFACE.card, 'flex flex-col gap-3 p-6')}>
      {['Health check passed', 'Build verified', 'Deployment ready'].map((item) => (
        <div key={item} className="flex items-center gap-3 text-sm text-[#1d1d1f]">
          <span
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs text-white',
              accent.checkmark ?? 'bg-rose-600'
            )}
          >
            &#10003;
          </span>
          {item}
        </div>
      ))}
    </div>
  );
}

/** Alternating Apple-style feature spotlight section. */
export function FeatureSpotlight({
  feature,
  reverse = false,
}: {
  feature: Spotlight;
  reverse?: boolean;
}) {
  const accent = INTRO_ACCENTS[feature.id];
  const copyWrapperClass = accent.stripe;

  return (
    <IntroSection id={feature.id} accentId={feature.id}>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <ScrollReveal className={cn('max-w-lg', reverse && 'lg:order-2 lg:ml-auto')}>
          <div className={copyWrapperClass}>
            <p
              className={cn(
                'text-xs font-semibold uppercase tracking-[0.08em]',
                accent.eyebrow
              )}
            >
              {feature.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#1d1d1f] sm:text-4xl lg:text-5xl">
              {feature.headline}
            </h2>
            <p className="mt-4 text-[17px] leading-[1.47] text-[#6e6e73]">
              {feature.subline}
            </p>
            <div className="mt-6">
              <MarketingTextLink href={feature.ctaHref}>{feature.cta}</MarketingTextLink>
            </div>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.1} className={cn(reverse && 'lg:order-1')}>
          <FeatureVisual id={feature.id} accent={accent} />
        </ScrollReveal>
      </div>
    </IntroSection>
  );
}
