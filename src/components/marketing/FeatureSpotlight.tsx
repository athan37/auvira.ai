'use client';

import { ScrollReveal } from '@/components/motion';
import { cn } from '@/lib/cn';
import { FEATURE_SPOTLIGHTS } from '@/content/marketing';
import { MarketingTextLink } from './MarketingLink';
import { ProductMock } from './ProductMock';
import { PromptDemo } from './PromptDemo';

type Spotlight = (typeof FEATURE_SPOTLIGHTS)[number];

function FeatureVisual({ id }: { id: Spotlight['id'] }) {
  if (id === 'describe') return <PromptDemo />;
  if (id === 'preview' || id === 'edit') return <ProductMock />;
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-6">
      {['Health check passed', 'Build verified', 'Deployment ready'].map((item) => (
        <div key={item} className="flex items-center gap-3 text-sm text-white/90">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs text-white">
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
  const isDark = feature.theme === 'dark';

  return (
    <section
      id={feature.id}
      className={cn(
        'scroll-mt-20 py-20 lg:py-28',
        isDark ? 'bg-[#1d1d1f] text-white' : 'bg-brand-canvas text-[#1d1d1f]'
      )}
    >
      <div className="mx-auto grid max-w-[980px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <ScrollReveal
          className={cn('max-w-lg', reverse && 'lg:order-2 lg:ml-auto')}
        >
          <p
            className={cn(
              'text-xs font-semibold uppercase tracking-[0.08em]',
              isDark ? 'text-[#86868b]' : 'text-[#6e6e73]'
            )}
          >
            {feature.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl lg:text-5xl">
            {feature.headline}
          </h2>
          <p
            className={cn(
              'mt-4 text-[17px] leading-[1.47]',
              isDark ? 'text-[#a1a1a6]' : 'text-[#6e6e73]'
            )}
          >
            {feature.subline}
          </p>
          <div className="mt-6">
            <MarketingTextLink href={feature.ctaHref} inverted={isDark}>
              {feature.cta}
            </MarketingTextLink>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.1} className={cn(reverse && 'lg:order-1')}>
          <FeatureVisual id={feature.id} />
        </ScrollReveal>
      </div>
    </section>
  );
}
