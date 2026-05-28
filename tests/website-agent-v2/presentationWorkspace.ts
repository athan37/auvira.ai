import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { SECTION_PRESENTATION_RUNTIME } from '@/lib/builder/sectionPresentationRuntime';

const SITE_CONFIG_SOURCE = `export type SiteSectionPresentation = {
  backgroundClass?: string;
  cardClass?: string;
  eyebrowClass?: string;
  titleClass?: string;
  bodyClass?: string;
};

export type SiteSection = {
  type: 'services' | 'about' | 'gallery' | 'testimonials';
  title: string;
  subtitle?: string;
  body?: string;
  items?: Array<{ title: string; description?: string; imageUrl?: string }>;
  presentation?: SiteSectionPresentation;
};

export const siteConfig = {
  businessName: 'Loop Co',
  hero: { headline: 'Welcome to Loop Co', subheadline: 'Local growth' },
  contact: { phone: '555-0100', email: 'hello@example.com' },
  sections: [
    { type: 'services', title: 'Services', items: [{ title: 'Consulting', description: 'Planning' }] },
    { type: 'about', title: 'About Us', body: 'A local team serving the community.' },
    {
      type: 'gallery',
      title: 'Hello',
      body: 'Our work in photos',
      items: [{ title: 'Project A', imageUrl: '/uploads/a.jpg' }],
    },
    {
      type: 'testimonials',
      title: 'What Our Customers Say',
      items: [
        { title: 'Jordan Lee', description: 'Great service and clear communication.' },
        { title: 'Maria Santos', description: 'Professional from start to finish.' },
      ],
    },
  ],
};`;

const PAGE_SOURCE = `${SECTION_PRESENTATION_RUNTIME}

import { siteConfig } from "../lib/siteConfig";

const preset = {
  pageBg: "bg-slate-50",
  mutedBg: "bg-slate-100",
  surfaceBg: "bg-white",
  contactBg: "bg-slate-200",
  card: "border border-slate-200 bg-white shadow-sm",
  sectionTitle: "text-slate-950",
  sectionBody: "text-slate-600",
  sectionEyebrow: "text-slate-500",
};

function ServicesSection({ section }: { section: SectionWithPresentation }) {
  return (
    <section className={"px-4 py-16 " + resolveSectionBackground(section, preset)}>
      <h2 className={resolveSectionTitleClass(section, preset)}>{section.title}</h2>
    </section>
  );
}

function AboutSection({ section }: { section: SectionWithPresentation }) {
  return (
    <section className={"px-4 py-16 " + resolveSectionBackground(section, preset)}>
      <h2 className={resolveSectionTitleClass(section, preset)}>{section.title}</h2>
      {section.body && <p className={resolveSectionBodyClass(section, preset)}>{section.body}</p>}
    </section>
  );
}

function GallerySection({ section }: { section: SectionWithPresentation }) {
  return (
    <section id="gallery" className={"px-4 py-20 " + resolveSectionBackground(section, preset)}>
      <h2 className={resolveSectionTitleClass(section, preset)}>{section.title}</h2>
    </section>
  );
}

function TestimonialsSection({ section }: { section: SectionWithPresentation }) {
  return (
    <section className={"px-4 py-16 " + resolveSectionBackground(section, preset)}>
      <h2 className={resolveSectionTitleClass(section, preset)}>{section.title}</h2>
      <div className={"rounded-2xl p-6 " + resolveSectionCardClass(section, preset)}>Card</div>
    </section>
  );
}

function SectionRenderer({ section }: { section: SectionWithPresentation }) {
  switch (section.type) {
    case "services":
      return <ServicesSection section={section} />;
    case "about":
      return <AboutSection section={section} />;
    case "gallery":
      return <GallerySection section={section} />;
    case "testimonials":
      return <TestimonialsSection section={section} />;
    default:
      return null;
  }
}

export default function Home() {
  return (
    <main className={preset.pageBg}>
      {siteConfig.sections.map((section) => (
        <SectionRenderer key={section.title} section={section} />
      ))}
    </main>
  );
}
`;

/** Scratch workspace with gallery, about, testimonials, and presentation resolvers. */
export async function createPresentationTestWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-presentation-llm-'));
  await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
  await fs.mkdir(path.join(dir, 'src/app'), { recursive: true });

  await fs.writeFile(path.join(dir, 'src/lib/siteConfig.ts'), SITE_CONFIG_SOURCE, 'utf-8');
  await fs.writeFile(path.join(dir, 'src/app/page.tsx'), PAGE_SOURCE, 'utf-8');
  await fs.writeFile(path.join(dir, 'src/app/globals.css'), 'body { background: white; }', 'utf-8');
  return dir;
}

export async function readWorkspaceSiteConfig(workspacePath: string): Promise<string> {
  return fs.readFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), 'utf-8');
}

export async function readWorkspacePage(workspacePath: string): Promise<string> {
  return fs.readFile(path.join(workspacePath, 'src/app/page.tsx'), 'utf-8');
}

export async function cleanupPresentationWorkspace(workspacePath: string): Promise<void> {
  await fs.rm(workspacePath, { recursive: true, force: true });
}
