import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import {
  MarketingHeader,
  MarketingFooter,
  FeatureSpotlight,
  LandingHero,
  LandingFinalCta,
} from '@/components/marketing';
import { BRAND, FEATURE_SPOTLIGHTS, FINAL_CTA } from '@/content/marketing';

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
};

/** Public landing page; authenticated users continue to the dashboard. */
export default async function Home() {
  const session = await auth();

  if (session) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-mesh-canvas">
      <MarketingHeader />
      <main>
        <LandingHero />
        {FEATURE_SPOTLIGHTS.map((feature, index) => (
          <FeatureSpotlight key={feature.id} feature={feature} reverse={index % 2 === 1} />
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
