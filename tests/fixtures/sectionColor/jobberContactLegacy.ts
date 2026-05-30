/**
 * Frozen regression fixture — real-world contact section shape (Jobber-style).
 * Use only after generic synthetic contract matrix passes.
 */

export const JOBBER_CONTACT_SITE_CONFIG = `export const siteConfig = {
  businessName: 'Jobber',
  sections: [
    {
      type: 'contact',
      title: 'Get Started Today',
      body: 'Contact us',
      items: [],
    },
  ],
};`;

export const JOBBER_CONTACT_LEGACY_PAGE = `import { siteConfig } from "../lib/siteConfig";

const preset = { contactBg: "bg-[#14532D]", surfaceBg: "bg-white", card: "border bg-white" };

function ContactSection({ section }) {
  return <section id="contact" className={"px-4 py-20 " + preset.contactBg}>{section.title}</section>;
}

function SectionRenderer({ section }) {
  if (section.type === "contact") return <ContactSection section={section} />;
  return null;
}

export default function Home() {
  return <main>{siteConfig.sections.map((s, i) => <SectionRenderer key={i} section={s} />)}</main>;
}`;

export const JOBBER_LAST_SECTION_RED_MESSAGE =
  'change background color of the last section to red';

export const JOBBER_CONTACT_EXPECTED_CLASS = 'bg-red-600';
