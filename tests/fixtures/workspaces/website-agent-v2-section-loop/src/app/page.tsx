import { siteConfig } from '@/lib/siteConfig';
import type { SiteSection } from '@/lib/siteConfig';

const preset = {
  surfaceBg: 'bg-white',
  mutedBg: 'bg-slate-100',
  blueSection: 'bg-blue-600 text-white',
  heroBg: 'bg-slate-900 text-white',
};

function HeroBlock() {
  return (
    <section className={preset.heroBg} data-section="hero">
      <h1>{siteConfig.hero.headline}</h1>
      {siteConfig.hero.subheadline && <p>{siteConfig.hero.subheadline}</p>}
      {siteConfig.hero.ctaLabel && <button type="button">{siteConfig.hero.ctaLabel}</button>}
    </section>
  );
}

function ServicesSection({ section }: { section: SiteSection }) {
  return (
    <section className={preset.surfaceBg} data-section="services">
      <h2>{section.title}</h2>
      <ul>
        {section.items?.map((item) => (
          <li key={item.title}>
            <strong>{item.title}</strong>
            {item.description && <p>{item.description}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AboutSection({ section }: { section: SiteSection }) {
  return (
    <section className={preset.blueSection} data-section="about">
      <h2>{section.title}</h2>
      {section.body && <p>{section.body}</p>}
    </section>
  );
}

function FaqSection({ section }: { section: SiteSection }) {
  return (
    <section className={preset.mutedBg} data-section="faq">
      <h2>{section.title}</h2>
      <dl>
        {section.items?.map((item) => (
          <div key={item.title}>
            <dt>{item.title}</dt>
            {item.description && <dd>{item.description}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}

function GenericSection({ section }: { section: SiteSection }) {
  return (
    <section className={preset.surfaceBg}>
      <h2>{section.title}</h2>
      {section.body && <p>{section.body}</p>}
    </section>
  );
}

function SectionRenderer({ section }: { section: SiteSection }) {
  switch (section.type) {
    case 'services':
      return <ServicesSection section={section} />;
    case 'about':
      return <AboutSection section={section} />;
    case 'faq':
      return <FaqSection section={section} />;
    default:
      return <GenericSection section={section} />;
  }
}

export default function Home() {
  return (
    <main>
      <HeroBlock />
      {siteConfig.sections.map((section, index) => (
        <SectionRenderer key={`${section.type}-${index}`} section={section} />
      ))}
    </main>
  );
}
