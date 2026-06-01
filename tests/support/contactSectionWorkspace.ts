/**
 * Synthetic workspace with a contact section that has an inner "Contact Information" panel
 * wired to resolveSectionCardClass (for element-level background edit tests).
 */

import path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { SECTION_PRESENTATION_RUNTIME } from '@/lib/builder/sectionPresentationRuntime';
import { stableAnalyticsIdForSection } from '@/lib/analytics/generated-sites/ensureAnalyticsIds';
import { scratchPath } from '@/lib/runtime/scratchDir';
import { buildSyntheticTailwindConfig } from './syntheticSiteWorkspace';

const EXISTING_SECTION_GRADIENT =
  'bg-gradient-to-r from-green-600 via-green-500 to-red-600';

const CONTACT_SECTION = {
  type: 'contact',
  title: 'hi, this hema',
  body: 'Ready to transform your home service business?',
};

export const CONTACT_SECTION_ANALYTICS_ID = stableAnalyticsIdForSection(
  CONTACT_SECTION,
  0
);

export async function createContactInfoPanelWorkspace(): Promise<string> {
  const id = randomUUID().slice(0, 8);
  const dir = scratchPath('project-workspaces', `contact-info-panel-${id}`);
  await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
  await fs.mkdir(path.join(dir, 'src/app'), { recursive: true });

  const siteConfig = `export const siteConfig = {
  businessName: 'Synthetic Contact Co',
  hero: { headline: 'Welcome', subheadline: 'Tagline', primaryCta: 'Start Free Trial' },
  contact: { phone: '(555) 123-4567', email: 'hello@example.com' },
  sections: [
    {
      type: '${CONTACT_SECTION.type}',
      title: '${CONTACT_SECTION.title}',
      body: '${CONTACT_SECTION.body}',
      analyticsId: '${CONTACT_SECTION_ANALYTICS_ID}',
      presentation: {
        backgroundClass: '${EXISTING_SECTION_GRADIENT}'
      }
    }
  ]
};`;

  const page = `${SECTION_PRESENTATION_RUNTIME}

import { siteConfig } from "../lib/siteConfig";

const preset = {
  pageBg: "bg-slate-200",
  surfaceBg: "bg-white",
  mutedBg: "bg-slate-100",
  contactBg: "bg-slate-900",
  card: "border border-white/10 bg-white/5",
  primaryButton: "bg-blue-600 text-white",
  secondaryButton: "border border-white/20 text-white",
  heroEyebrow: "text-slate-400",
};

function ContactSection({ section }) {
  const { contact } = siteConfig;
  return (
    <section data-section-type="contact" className={"px-4 py-20 " + resolveSectionBackground(section, preset) + " text-white"}>
      <div className="mx-auto max-w-7xl grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-widest">Get in Touch</p>
          <h2 className="text-4xl font-bold">{section.title}</h2>
          {section.body && <p className="mt-6 text-lg text-slate-300">{section.body}</p>}
        </div>
        <div className={"rounded-[2rem] border p-8 shadow-2xl " + resolveSectionCardClass(section, preset)}>
          <h3 className="text-xl font-bold">Contact Information</h3>
          <div className="mt-6 space-y-4">
            {contact.phone && <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">{contact.phone}</div>}
            {contact.email && <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">{contact.email}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main>
      {siteConfig.sections.map((section, index) => (
        <ContactSection key={index} section={section} />
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

  return dir;
}

export { EXISTING_SECTION_GRADIENT };
