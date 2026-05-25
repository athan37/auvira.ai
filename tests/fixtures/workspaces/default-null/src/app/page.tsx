import { siteConfig } from '@/lib/siteConfig';

function SectionRenderer({ section }: { section: { type: string; title: string } }) {
  switch (section.type) {
    case 'services':
      return <section>{section.title}</section>;
    default:
      return null;
  }
}

export default function Home() {
  return (
    <main>
      {siteConfig.sections.map((section, index) => (
        <SectionRenderer key={index} section={section} />
      ))}
    </main>
  );
}
