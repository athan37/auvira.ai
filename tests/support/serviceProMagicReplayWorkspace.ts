/**
 * Self-contained workspace for ServiceProMagic hero gradient replay tests.
 * Replaces dependency on `.tmp/git-workspaces/...` from local clone jobs.
 */

import path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { SECTION_PRESENTATION_RUNTIME } from '@/lib/builder/sectionPresentationRuntime';
import { scratchPath } from '@/lib/runtime/scratchDir';
import { buildSyntheticTailwindConfig } from './syntheticSiteWorkspace';

export const SERVICEPRO_HERO_HEADLINE = 'Your HVAC Website Should Work as Hard as You Do';
export const SERVICEPRO_SERVICES_TITLE = 'Everything Your HVAC Website Needs to Succeed';
export const SERVICEPRO_ABOUT_TITLE = 'Why ServiceProMagic?';
export const SERVICEPRO_GENERIC_TITLE = 'See ServiceProMagic in Action';

export const SERVICEPRO_HERO_GRADIENT_MSG = `change color of the "${SERVICEPRO_HERO_HEADLINE}" section's background from red to green color gradient`;

function escapeJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildSiteConfigSource(): string {
  return `export const siteConfig = {
  businessName: 'ServiceProMagic',
  hero: {
    headline: "${escapeJs(SERVICEPRO_HERO_HEADLINE)}",
    subheadline: "Convert more HVAC leads",
    primaryCta: "Get Started",
  },
  contact: { phone: '555-0100', email: 'hello@servicepromagic.test' },
  sections: [
    {
      type: 'services',
      title: '${escapeJs(SERVICEPRO_SERVICES_TITLE)}',
      body: 'Full-service HVAC marketing.',
      items: [],
    },
    {
      type: 'about',
      title: '${escapeJs(SERVICEPRO_ABOUT_TITLE)}',
      body: 'We help contractors grow.',
      items: [],
    },
    {
      type: 'generic',
      title: '${escapeJs(SERVICEPRO_GENERIC_TITLE)}',
      body: 'Watch how we build high-converting sites.',
      presentation: { backgroundClass: 'bg-slate-100' },
      items: [],
    },
  ],
};`;
}

function buildPageSource(): string {
  return `// @ts-nocheck
import { siteConfig } from '@/lib/siteConfig';

const preset = {
  pageBg: 'bg-red-950',
  heroBg: 'bg-gradient-to-br from-red-800 via-red-700 to-red-900',
  heroOverlay: 'bg-red-900/20',
  heroText: 'text-white',
  heroMutedText: 'text-red-100',
  heroEyebrow: 'text-red-200',
  surfaceBg: 'bg-white',
  mutedBg: 'bg-red-50',
  navBg: 'bg-red-950/95',
  navBorder: 'border-red-800',
  navText: 'text-white',
  primaryButton: 'bg-red-600 text-white',
  secondaryButton: 'border-white/30 text-white',
  darkButton: 'bg-red-900 text-white',
  card: 'bg-white border border-red-100 shadow-sm',
  cardHover: 'hover:-translate-y-1 hover:shadow-xl',
  cardAccent: 'border-t-red-600',
  iconBadge: 'bg-red-600 text-white',
  sectionEyebrow: 'text-red-700',
  sectionTitle: 'text-slate-950',
  sectionBody: 'text-slate-600',
  contactBg: 'bg-red-950',
  footerBg: 'bg-red-950',
  footerAccent: 'text-red-200',
  fontHeading: 'font-serif',
  fontBody: 'font-sans',
  sectionSpacing: 'px-4 py-20 sm:px-6 lg:px-8',
};

${SECTION_PRESENTATION_RUNTIME}

function Hero() {
  const { hero } = siteConfig;
  return (
    <section
      data-analytics-id="hero"
      data-analytics-type="hero"
      data-site-section-id="hero"
      data-site-section-type="hero"
      className={'relative overflow-hidden ' + preset.heroBg + ' px-4 py-24 text-white'}
    >
      <div className={'absolute inset-0 ' + preset.heroOverlay} />
      <div className="relative mx-auto max-w-4xl">
        <h1 className={'text-5xl font-bold ' + preset.heroText}>{hero.headline}</h1>
        {hero.subheadline && <p className={'mt-4 text-xl ' + preset.heroMutedText}>{hero.subheadline}</p>}
      </div>
    </section>
  );
}

function ServicesSection({ section }) {
  return (
    <section data-site-section-type="services" className={'px-4 py-16 ' + resolveSectionBackground(section, preset)}>
      <h2 className="text-3xl font-bold">{section.title}</h2>
    </section>
  );
}

function AboutSection({ section }) {
  return (
    <section data-site-section-type="about" className={'px-4 py-16 ' + resolveSectionBackground(section, preset)}>
      <h2 className="text-3xl font-bold">{section.title}</h2>
    </section>
  );
}

function GenericSection({ section }) {
  return (
    <section data-site-section-type="generic" className={'px-4 py-16 ' + resolveSectionBackground(section, preset)}>
      <h2 className="text-3xl font-bold">{section.title}</h2>
      {section.body && <p className="mt-4">{section.body}</p>}
    </section>
  );
}

function SectionRenderer({ section, sectionIndex }) {
  switch (section.type) {
    case 'services':
      return <ServicesSection section={section} />;
    case 'about':
      return <AboutSection section={section} />;
    default:
      return <GenericSection section={section} />;
  }
}

export default function Home() {
  return (
    <main className={preset.pageBg}>
      <Hero />
      {siteConfig.sections.map((section, index) => (
        <SectionRenderer key={index} section={section} sectionIndex={index} />
      ))}
    </main>
  );
}
`;
}

/** Create an isolated scratch workspace mirroring ServiceProMagic hero replay needs. */
export async function createServiceProMagicReplayWorkspace(): Promise<string> {
  const dir = scratchPath(`servicepromagic-replay-${randomUUID().slice(0, 8)}`);
  await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
  await fs.mkdir(path.join(dir, 'src/app'), { recursive: true });

  await fs.writeFile(path.join(dir, 'src/lib/siteConfig.ts'), buildSiteConfigSource(), 'utf-8');
  await fs.writeFile(path.join(dir, 'src/app/page.tsx'), buildPageSource(), 'utf-8');
  await fs.writeFile(path.join(dir, 'src/app/globals.css'), 'body { margin: 0; }', 'utf-8');
  await fs.writeFile(
    path.join(dir, 'tailwind.config.js'),
    buildSyntheticTailwindConfig('canonical'),
    'utf-8'
  );
  await fs.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'servicepromagic-replay', private: true, scripts: {} }),
    'utf-8'
  );

  return dir;
}
