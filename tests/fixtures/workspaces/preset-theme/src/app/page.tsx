import { siteConfig } from '@/lib/siteConfig';

const preset = {
  pageBg: 'bg-red-900',
  heroBg: 'bg-red-800',
  surfaceBg: 'bg-white',
  heroText: 'text-white',
  sectionTitle: 'text-black',
};

export default function Home() {
  return (
    <main className={preset.pageBg}>
      <h1 className={preset.heroText}>{siteConfig.hero.headline}</h1>
    </main>
  );
}
