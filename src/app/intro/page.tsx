import type { Metadata } from 'next';
import {
  MarketingHeader,
  MarketingFooter,
  NarrativeSection,
  LandingHero,
} from '@/components/marketing';
import { BRAND, INTRO_NARRATIVE } from '@/content/marketing';
import { INTRO } from '@/content/marketingTheme';

export const metadata: Metadata = {
  title: `${BRAND.name} | ${BRAND.tagline}`,
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
        {INTRO_NARRATIVE.map((section, index) => (
          <NarrativeSection
            key={section.id}
            section={section}
            reverse={index % 2 === 1}
          />
        ))}
      </main>
      <MarketingFooter />
    </div>
  );
}
