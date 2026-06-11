'use client';

import { ScrollReveal } from '@/components/motion';
import { cn } from '@/lib/cn';
import { INTRO_NARRATIVE } from '@/content/marketing';
import { INTRO_ACCENTS } from '@/content/marketingTheme';
import { IntroSection } from './IntroSection';
import { IntroSectionDemo } from './intro-demos/IntroSectionDemo';

type Narrative = (typeof INTRO_NARRATIVE)[number];

/** About-style narrative block for the intro landing page. */
export function NarrativeSection({
  section,
  reverse = false,
}: {
  section: Narrative;
  reverse?: boolean;
}) {
  const accent = INTRO_ACCENTS[section.id];
  const copyWrapperClass = accent.stripe;

  const copy = (
    <div className={copyWrapperClass}>
      <p
        className={cn(
          'text-xs font-semibold uppercase tracking-[0.08em]',
          section.id === 'vision' ? 'text-brand-ai' : accent.eyebrow
        )}
      >
        {section.eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#1d1d1f] sm:text-4xl lg:text-5xl">
        {section.headline}
      </h2>
      <p className="mt-4 text-[17px] leading-[1.47] text-[#6e6e73]">{section.subline}</p>
      {'tagline' in section && section.tagline && (
        <p className="mt-6 text-base font-semibold tracking-wide text-brand-ai sm:text-lg">
          {section.tagline}
        </p>
      )}
    </div>
  );

  return (
    <IntroSection id={section.id} accentId={section.id}>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <ScrollReveal className={cn('max-w-lg', reverse && 'lg:order-2 lg:ml-auto')}>
          {copy}
        </ScrollReveal>
        <ScrollReveal delay={0.1} className={cn(reverse && 'lg:order-1')}>
          <IntroSectionDemo demo={section.demo} accentId={section.id} />
        </ScrollReveal>
      </div>
    </IntroSection>
  );
}
