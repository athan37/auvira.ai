import type { Metadata } from 'next';
import {
  MarketingHeader,
  MarketingFooter,
  FeatureSpotlight,
  LandingHero,
  LandingFinalCta,
} from '@/components/marketing';
import { BRAND, FEATURE_SPOTLIGHTS, FINAL_CTA } from '@/content/marketing';
import { INTRO } from '@/content/marketingTheme';

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
};

/** Public intro / landing page — available to all visitors, signed in or not. */
export default function IntroPage() {
  return (
    <div className="relative min-h-screen">
      <div
        className={`${INTRO.pageMesh} pointer-events-none fixed inset-0 -z-10`}
        aria-hidden
      />
      <MarketingHeader />
      <main>
        <LandingHero />
        {FEATURE_SPOTLIGHTS.map((feature, index) => (
          <FeatureSpotlight
            key={feature.id}
            feature={feature}
            reverse={index % 2 === 1}
          />
        ))}
        <LandingFinalCta
          headline={FINAL_CTA.headline}
          subline={FINAL_CTA.subline}
          cta={FINAL_CTA.cta}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
