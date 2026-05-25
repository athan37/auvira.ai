import { siteConfig } from '@/lib/siteConfig';
import type { SiteSection } from '@/lib/siteConfig';

const preset = { surfaceBg: 'bg-white', sectionTitle: 'text-black', card: 'border' };

function ServicesSection({ section }: { section: SiteSection }) {
  return <section id="services"><h2>{section.title}</h2></section>;
}

function GenericSection({ section }: { section: SiteSection }) {
  return (
    <section>
      {section.body && <p>{section.body}</p>}
      {section.items && section.items.length > 0 && (
        <div className="grid">text</div>
      )}
    </section>
  );
}

function SectionRenderer({ section }: { section: SiteSection }) {
  switch (section.type) {
    case 'services':
      return <ServicesSection section={section} />;
    default:
      return <GenericSection section={section} />;
  }
}

export default function Home() {
  return (
    <main>
      {siteConfig.sections.map((section, index) => (
        <SectionRenderer key={section.type + '-' + index} section={section} />
      ))}
    </main>
  );
}
