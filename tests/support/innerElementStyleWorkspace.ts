/**
 * Synthetic workspaces for inner-element (cardClass) vs section-background style edits.
 */

import path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { SECTION_PRESENTATION_RUNTIME } from '@/lib/builder/sectionPresentationRuntime';
import { stableAnalyticsIdForSection } from '@/lib/analytics/generated-sites/ensureAnalyticsIds';
import { scratchPath } from '@/lib/runtime/scratchDir';
import { buildSyntheticTailwindConfig } from './syntheticSiteWorkspace';

export const DEFAULT_SECTION_BACKGROUND = 'bg-slate-100';
export const DEFAULT_EXISTING_CARD_CLASS = 'border-slate-200 bg-white';

export interface InnerElementSectionSpec {
  type: string;
  title: string;
  body?: string;
  items?: Array<{ title: string; description?: string; imageUrl?: string }>;
}

export interface InnerElementStyleWorkspaceSpec {
  /** Primary section under test (index 0 unless extraSections prepended). */
  section: InnerElementSectionSpec;
  /** Sections inserted before the primary section (for pin-by-index tests). */
  prefixSections?: InnerElementSectionSpec[];
  existingBackgroundClass?: string;
  existingCardClass?: string;
}

function escapeJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function itemsJson(items: InnerElementSectionSpec['items']): string {
  if (!items?.length) return '[]';
  return `[${items
    .map((item) => {
      const parts = [`title: '${escapeJs(item.title)}'`];
      if (item.description) parts.push(`description: '${escapeJs(item.description)}'`);
      if (item.imageUrl) parts.push(`imageUrl: '${escapeJs(item.imageUrl)}'`);
      return `{ ${parts.join(', ')} }`;
    })
    .join(', ')}]`;
}

function sectionConfigBlock(
  section: InnerElementSectionSpec,
  index: number,
  presentation: { backgroundClass: string; cardClass?: string }
): string {
  const analyticsId = stableAnalyticsIdForSection(section, index);
  const presentationLines = presentation.cardClass
    ? `presentation: {
        backgroundClass: '${presentation.backgroundClass}',
        cardClass: '${presentation.cardClass}',
      }`
    : `presentation: {
        backgroundClass: '${presentation.backgroundClass}',
      }`;
  return `    {
      type: '${escapeJs(section.type)}',
      title: '${escapeJs(section.title)}',
      body: '${escapeJs(section.body ?? 'Synthetic body')}',
      items: ${itemsJson(section.items)},
      analyticsId: '${analyticsId}',
      ${presentationLines}
    }`;
}

function servicesPage(): string {
  return `function ServicesSection({ section }) {
  return (
    <section data-section-type="services" className={"px-4 py-16 " + resolveSectionBackground(section, preset)}>
      <h2 className="text-3xl font-bold mb-8">{section.title}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {(section.items || []).map((item, i) => (
          <div key={i} className={"rounded-3xl border p-6 " + resolveSectionCardClass(section, preset)}>
            <h3 className="font-bold">{item.title}</h3>
            {item.description && <p className="mt-2 text-sm">{item.description}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}`;
}

function testimonialsPage(): string {
  return `function TestimonialsSection({ section }) {
  return (
    <section data-section-type="testimonials" className={"px-4 py-16 " + resolveSectionBackground(section, preset)}>
      <h2 className="text-3xl font-bold mb-8">{section.title}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {(section.items || []).map((item, i) => (
          <div key={i} className={"rounded-3xl border p-6 " + resolveSectionCardClass(section, preset)}>
            <p className="italic">{item.description || 'Great work'}</p>
            <p className="mt-3 font-semibold">- {item.title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`;
}

function faqPage(): string {
  return `function FaqSection({ section }) {
  return (
    <section data-section-type="faq" className={"px-4 py-16 " + resolveSectionBackground(section, preset)}>
      <h2 className="text-3xl font-bold mb-8">{section.title}</h2>
      <div className="space-y-4 max-w-2xl">
        {(section.items || []).map((item, i) => (
          <div key={i} className={"rounded-2xl border p-5 " + resolveSectionCardClass(section, preset)}>
            <h3 className="font-bold">{item.title}</h3>
            {item.description && <p className="mt-2 text-sm">{item.description}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}`;
}

function galleryPage(): string {
  return `function GallerySection({ section }) {
  return (
    <section data-section-type="gallery" className={"px-4 py-16 " + resolveSectionBackground(section, preset)}>
      <h2 className="text-3xl font-bold mb-8">{section.title}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {(section.items || []).filter((item) => item.imageUrl).map((item, i) => (
          <figure key={i} className={"overflow-hidden rounded-3xl border " + resolveSectionCardClass(section, preset)}>
            <img src={item.imageUrl} alt={item.title} className="h-48 w-full object-cover" />
            {item.description && <figcaption className="p-3 text-sm">{item.description}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  );
}`;
}

function contactPage(): string {
  return `function ContactSection({ section }) {
  const { contact } = siteConfig;
  return (
    <section data-section-type="contact" className={"px-4 py-16 " + resolveSectionBackground(section, preset) + " text-white"}>
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-widest mb-2">Get in Touch</p>
          <h2 className="text-4xl font-bold">{section.title}</h2>
          {section.body && <p className="mt-4 text-slate-300">{section.body}</p>}
        </div>
        <div className={"rounded-[2rem] border p-8 " + resolveSectionCardClass(section, preset)}>
          <h3 className="text-xl font-bold">Contact Information</h3>
          <div className="mt-4 space-y-3">
            {contact.phone && <div className="rounded-xl border p-3 text-sm">{contact.phone}</div>}
            {contact.email && <div className="rounded-xl border p-3 text-sm">{contact.email}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}`;
}

function featuresPage(): string {
  return `function FeaturesSection({ section }) {
  return (
    <section data-section-type="features" className={"px-4 py-16 " + resolveSectionBackground(section, preset)}>
      <h2 className="text-3xl font-bold mb-8">{section.title}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {(section.items || []).map((item, i) => (
          <div key={i} className={"rounded-3xl border p-6 " + resolveSectionCardClass(section, preset)}>
            <h3 className="font-bold">{item.title}</h3>
            {item.description && <p className="mt-2 text-sm">{item.description}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}`;
}

function aboutPage(): string {
  return `function AboutSection({ section }) {
  return (
    <section data-section-type="about" className={"px-4 py-16 " + resolveSectionBackground(section, preset)}>
      <h2 className="text-3xl font-bold">{section.title}</h2>
      {section.body && <p className="mt-4">{section.body}</p>}
    </section>
  );
}`;
}

const PAGE_BY_TYPE: Record<string, { component: string; render: () => string }> = {
  about: { component: 'AboutSection', render: aboutPage },
  services: { component: 'ServicesSection', render: servicesPage },
  testimonials: { component: 'TestimonialsSection', render: testimonialsPage },
  faq: { component: 'FaqSection', render: faqPage },
  gallery: { component: 'GallerySection', render: galleryPage },
  contact: { component: 'ContactSection', render: contactPage },
  features: { component: 'FeaturesSection', render: featuresPage },
};

export interface InnerElementStyleWorkspaceResult {
  workspacePath: string;
  targetSectionIndex: number;
  analyticsId: string;
  existingBackgroundClass: string;
  existingCardClass?: string;
}

/**
 * Create a scratch workspace with cardClass wired on inner elements for one section type.
 */
export async function createInnerElementStyleWorkspace(
  spec: InnerElementStyleWorkspaceSpec
): Promise<InnerElementStyleWorkspaceResult> {
  const id = randomUUID().slice(0, 8);
  const dir = scratchPath('project-workspaces', `inner-element-style-${id}`);
  await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
  await fs.mkdir(path.join(dir, 'src/app'), { recursive: true });

  const existingBackgroundClass = spec.existingBackgroundClass ?? DEFAULT_SECTION_BACKGROUND;
  const existingCardClass = spec.existingCardClass;
  const prefix = spec.prefixSections ?? [];
  const allSections = [...prefix, spec.section];
  const targetSectionIndex = prefix.length;

  const sectionBlocks = allSections.map((section, index) =>
    sectionConfigBlock(
      section,
      index,
      index === targetSectionIndex
        ? { backgroundClass: existingBackgroundClass, cardClass: existingCardClass }
        : { backgroundClass: DEFAULT_SECTION_BACKGROUND }
    )
  );

  const targetAnalyticsId = stableAnalyticsIdForSection(spec.section, targetSectionIndex);
  const primaryType = spec.section.type.toLowerCase();
  const pageDef = PAGE_BY_TYPE[primaryType];
  if (!pageDef) {
    throw new Error(`Unsupported inner element style section type: ${spec.section.type}`);
  }

  const usedTypes = [...new Set(allSections.map((s) => s.type.toLowerCase()))];
  const componentSources = usedTypes
    .map((type) => PAGE_BY_TYPE[type]?.render())
    .filter(Boolean)
    .join('\n\n');

  const switchCases = allSections
    .map((section, index) => {
      const type = section.type.toLowerCase();
      const component = PAGE_BY_TYPE[type]?.component ?? 'GenericSection';
      return `    if (index === ${index}) return <${component} section={section} />;`;
    })
    .join('\n');

  const siteConfig = `export const siteConfig = {
  businessName: 'Inner Element Style Co',
  hero: { headline: 'Welcome', subheadline: 'Tagline' },
  contact: { phone: '(555) 123-4567', email: 'hello@example.com' },
  sections: [
${sectionBlocks.join(',\n')}
  ],
};`;

  const page = `${SECTION_PRESENTATION_RUNTIME}

import { siteConfig } from "../lib/siteConfig";

const preset = {
  pageBg: "bg-slate-200",
  surfaceBg: "bg-white",
  mutedBg: "bg-slate-100",
  contactBg: "bg-slate-900",
  card: "border border-slate-200 bg-white",
  primaryButton: "bg-blue-600 text-white",
  heroEyebrow: "text-slate-500",
};

${componentSources}

function SectionRenderer({ section, index }) {
${switchCases}
  return null;
}

export default function Home() {
  return (
    <main>
      {siteConfig.sections.map((section, index) => (
        <SectionRenderer key={index} section={section} index={index} />
      ))}
    </main>
  );
}
`;

  await fs.writeFile(path.join(dir, 'src/lib/siteConfig.ts'), siteConfig, 'utf-8');
  await fs.writeFile(path.join(dir, 'src/app/page.tsx'), page, 'utf-8');
  await fs.writeFile(path.join(dir, 'src/app/globals.css'), 'body {}', 'utf-8');
  await fs.writeFile(
    path.join(dir, 'tailwind.config.js'),
    buildSyntheticTailwindConfig('canonical'),
    'utf-8'
  );

  return {
    workspacePath: dir,
    targetSectionIndex,
    analyticsId: targetAnalyticsId,
    existingBackgroundClass,
    existingCardClass,
  };
}
