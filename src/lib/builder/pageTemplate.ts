// Fixed data-driven page renderer - NO HTML string injection
// This template is used as-is with only preset JSON substitution

import { SECTION_PRESENTATION_RUNTIME } from './sectionPresentationRuntime';

export const PAGE_TSX_TEMPLATE = `// @ts-nocheck
import { siteConfig } from "@/lib/siteConfig";
import type { SiteSection } from "@/lib/siteConfig";

// Theme preset - injected at build time
const preset = __PRESET_JSON__;

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function SITE_SECTION_DATA_ATTRS(section: SiteSection, sectionIndex: number) {
  return {
    "data-analytics-id": section.analyticsId || section.id || slugify(String(section.title || "section")),
    "data-analytics-type": "section",
    "data-analytics-label": section.title,
    "data-site-section-id": section.analyticsId || section.id || slugify(String(section.title || "section")),
    "data-site-section-index": String(sectionIndex),
    "data-site-section-type": section.type,
    "data-site-section-title": section.title,
  };
}

${SECTION_PRESENTATION_RUNTIME}

// Navigation component
function Nav() {
  return (
    <nav className={"sticky top-0 z-50 border-b " + preset.navBorder + " " + preset.navBg}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <a href="#" className={"font-bold text-xl tracking-tight " + preset.navText}>{siteConfig.businessName}</a>
        {siteConfig.hero.primaryCta && (
          <a href="#contact" className={"inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold " + preset.primaryButton}>
            {siteConfig.hero.primaryCta}
          </a>
        )}
      </div>
    </nav>
  );
}

// Hero section
function Hero() {
  const { hero } = siteConfig;
  return (
    <section data-analytics-id="hero" data-analytics-type="hero" data-analytics-label="Hero" data-site-section-id="hero" data-site-section-index="-1" data-site-section-type="hero" data-site-section-title="Hero" className={"relative overflow-hidden " + preset.heroBg + " px-4 py-24 text-white sm:px-6 lg:px-8 lg:py-32"}>
      <div className={"absolute inset-0 " + preset.heroOverlay} />
      <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          {hero.eyebrow && <p className={"mb-5 text-xs font-bold uppercase tracking-[0.3em] " + preset.heroEyebrow}>{hero.eyebrow}</p>}
          <h1 className={"font-serif text-5xl font-semibold tracking-tight md:text-7xl " + preset.heroText}>{hero.headline}</h1>
          {hero.subheadline && <p className={"mt-6 max-w-2xl text-xl leading-9 " + preset.heroMutedText}>{hero.subheadline}</p>}
          <div className="mt-9 flex flex-wrap gap-4">
            {hero.primaryCta && (
              <a href="#contact" className={"inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold shadow-lg shadow-black/20 transition hover:-translate-y-0.5 " + preset.primaryButton}>{hero.primaryCta}</a>
            )}
            {hero.secondaryCta && (
              <a href="#services" className={"inline-flex items-center justify-center rounded-full border-2 border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 " + preset.secondaryButton}>{hero.secondaryCta}</a>
            )}
          </div>
        </div>
        <div className={"rounded-[2rem] border border-white/10 " + preset.surfaceBg + " p-8 text-slate-950 shadow-2xl"}>
          <p className={"text-xs font-bold uppercase tracking-[0.25em] " + preset.sectionEyebrow}>Get Started</p>
          <h2 className="mt-4 font-serif text-3xl font-semibold">Ready to work with us?</h2>
          <p className="mt-4 leading-7 text-slate-600">Get clear next steps and a professional experience from the first conversation.</p>
          {siteConfig.contact.phone && (
            <div className={"mt-6 rounded-2xl " + preset.mutedBg + " p-4 font-semibold"}>{siteConfig.contact.phone}</div>
          )}
          {siteConfig.contact.email && (
            <div className={"mt-3 rounded-2xl " + preset.mutedBg + " p-4 font-semibold"}>{siteConfig.contact.email}</div>
          )}
        </div>
      </div>
    </section>
  );
}

// Services section renderer
function ServicesSection({ section, sectionIndex }: { section: SiteSection; sectionIndex: number }) {
  return (
    <section id="services" {...SITE_SECTION_DATA_ATTRS(section, sectionIndex)} className={"px-4 py-20 sm:px-6 lg:px-8 " + resolveSectionBackground(section, preset)}>
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center mb-14">
          <p className={"mb-3 text-xs font-bold uppercase tracking-[0.28em] " + resolveSectionEyebrowClass(section, preset)}>Services</p>
          <h2 className={"text-3xl font-semibold tracking-tight md:text-5xl " + resolveSectionTitleClass(section, preset)}>{section.title}</h2>
          {section.body && <p className={"mt-5 text-lg leading-8 " + resolveSectionBodyClass(section, preset)}>{section.body}</p>}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {section.items?.slice(0, 6).map((item, i) => (
            <div key={i} className={"rounded-3xl border p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl " + resolveSectionCardClass(section, preset)}>
              <div className={"mb-5 flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white " + preset.iconBadge}>{i + 1}</div>
              <h3 className="text-lg font-bold text-slate-950">{item.title}</h3>
              {item.description && <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// About section renderer
function AboutSection({ section, sectionIndex }: { section: SiteSection; sectionIndex: number }) {
  return (
    <section id="about" {...SITE_SECTION_DATA_ATTRS(section, sectionIndex)} className={"px-4 py-20 sm:px-6 lg:px-8 " + resolveSectionBackground(section, preset)}>
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center mb-14">
          <p className={"mb-3 text-xs font-bold uppercase tracking-[0.28em] " + resolveSectionEyebrowClass(section, preset)}>About</p>
          <h2 className={"text-3xl font-semibold tracking-tight md:text-5xl " + resolveSectionTitleClass(section, preset)}>{section.title}</h2>
          {section.body && <p className={"mt-5 text-lg leading-8 " + resolveSectionBodyClass(section, preset)}>{section.body}</p>}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {section.items?.slice(0, 6).map((item, i) => (
            <div key={i} className={"rounded-3xl border p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl " + resolveSectionCardClass(section, preset)}>
              <h3 className="text-lg font-bold text-slate-950">{item.title}</h3>
              {item.description && <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Features section renderer
function FeaturesSection({ section, sectionIndex }: { section: SiteSection; sectionIndex: number }) {
  return (
    <section id="features" {...SITE_SECTION_DATA_ATTRS(section, sectionIndex)} className={"px-4 py-20 sm:px-6 lg:px-8 " + resolveSectionBackground(section, preset)}>
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center mb-14">
          <p className={"mb-3 text-xs font-bold uppercase tracking-[0.28em] " + resolveSectionEyebrowClass(section, preset)}>Features</p>
          <h2 className={"text-3xl font-semibold tracking-tight md:text-5xl " + resolveSectionTitleClass(section, preset)}>{section.title}</h2>
          {section.body && <p className={"mt-5 text-lg leading-8 " + resolveSectionBodyClass(section, preset)}>{section.body}</p>}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {section.items?.slice(0, 6).map((item, i) => (
            <div key={i} className={"rounded-3xl border p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl " + resolveSectionCardClass(section, preset)}>
              <h3 className="text-lg font-bold text-slate-950">{item.title}</h3>
              {item.description && <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// FAQ section renderer
function FaqSection({ section, sectionIndex }: { section: SiteSection; sectionIndex: number }) {
  return (
    <section id="faq" {...SITE_SECTION_DATA_ATTRS(section, sectionIndex)} className={"px-4 py-20 sm:px-6 lg:px-8 " + resolveSectionBackground(section, preset)}>
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center mb-14">
          <p className={"mb-3 text-xs font-bold uppercase tracking-[0.28em] " + resolveSectionEyebrowClass(section, preset)}>FAQ</p>
          <h2 className={"text-3xl font-semibold tracking-tight md:text-5xl " + resolveSectionTitleClass(section, preset)}>{section.title}</h2>
          {section.body && <p className={"mt-5 text-lg leading-8 " + resolveSectionBodyClass(section, preset)}>{section.body}</p>}
        </div>
        <div className="space-y-4 max-w-3xl mx-auto">
          {section.items?.slice(0, 8).map((item, i) => (
            <div key={i} className={"rounded-2xl border p-6 " + resolveSectionCardClass(section, preset)}>
              <h3 className="text-lg font-bold text-slate-950">{item.title}</h3>
              {item.description && <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Testimonials section renderer
function TestimonialsSection({ section, sectionIndex }: { section: SiteSection; sectionIndex: number }) {
  return (
    <section id="testimonials" {...SITE_SECTION_DATA_ATTRS(section, sectionIndex)} className={"px-4 py-20 sm:px-6 lg:px-8 " + resolveSectionBackground(section, preset)}>
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center mb-14">
          <p className={"mb-3 text-xs font-bold uppercase tracking-[0.28em] " + resolveSectionEyebrowClass(section, preset)}>Testimonials</p>
          <h2 className={"text-3xl font-semibold tracking-tight md:text-5xl " + resolveSectionTitleClass(section, preset)}>{section.title}</h2>
          {section.body && <p className={"mt-5 text-lg leading-8 " + resolveSectionBodyClass(section, preset)}>{section.body}</p>}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {section.items?.slice(0, 6).map((item, i) => (
            <div key={i} className={"rounded-3xl border p-7 shadow-sm " + resolveSectionCardClass(section, preset)}>
              <p className="text-slate-600 italic">&ldquo;{item.description || 'Great service!'}&rdquo;</p>
              <p className="mt-4 font-semibold text-slate-950">- {item.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Contact section renderer
function ContactSection({ section, sectionIndex }: { section: SiteSection; sectionIndex: number }) {
  const { contact } = siteConfig;
  return (
    <section id="contact" {...SITE_SECTION_DATA_ATTRS(section, sectionIndex)} className={"px-4 py-20 sm:px-6 lg:px-8 " + resolveSectionBackground(section, preset) + " text-white"}>
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className={"mb-4 text-xs font-bold uppercase tracking-[0.28em] " + preset.heroEyebrow}>Get in Touch</p>
            <h2 className="font-bold text-4xl tracking-tight md:text-6xl">{section.title}</h2>
            {section.body && <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{section.body}</p>}
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              {siteConfig.hero.primaryCta && (
                <a href="#contact" className={"inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold shadow-lg shadow-black/20 transition hover:-translate-y-0.5 " + preset.primaryButton}>{siteConfig.hero.primaryCta}</a>
              )}
              {contact.phone && (
                <a href={"tel:" + contact.phone.replace(/[^0-9]/g, "")} className={"inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 " + preset.secondaryButton}>{contact.phone}</a>
              )}
            </div>
          </div>
          <div className={"rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl"}>
            <h3 className="text-xl font-bold">Contact Information</h3>
            <div className="mt-6 space-y-4">
              {contact.phone && <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">{contact.phone}</div>}
              {contact.email && <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">{contact.email}</div>}
              {contact.address && <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">{contact.address}</div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Product / project photo gallery
function GallerySection({ section, sectionIndex }: { section: SiteSection; sectionIndex: number }) {
  const images = (section.items || []).filter((item) => (item as { imageUrl?: string }).imageUrl);
  const count = images.length;
  const gridClass =
    count <= 1
      ? "mx-auto max-w-4xl"
      : count === 2
        ? "grid gap-8 md:grid-cols-2"
        : count === 3
          ? "grid gap-8 md:grid-cols-3"
          : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section id="gallery" {...SITE_SECTION_DATA_ATTRS(section, sectionIndex)} className={"px-4 py-20 sm:px-6 lg:px-8 " + resolveSectionBackground(section, preset)}>
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <p className={"mb-3 text-xs font-bold uppercase tracking-[0.28em] " + resolveSectionEyebrowClass(section, preset)}>Gallery</p>
          <h2 className={"text-3xl font-semibold tracking-tight md:text-5xl " + resolveSectionTitleClass(section, preset)}>{section.title}</h2>
          {section.body && <p className={"mt-5 text-lg leading-8 " + resolveSectionBodyClass(section, preset)}>{section.body}</p>}
        </div>
        {count > 0 && (
          <div className={gridClass}>
            {images.map((item, i) => (
              <figure
                key={i}
                className={
                  count === 1
                    ? "overflow-hidden rounded-[2rem] border shadow-xl " + resolveSectionCardClass(section, preset)
                    : "overflow-hidden rounded-3xl border shadow-md " + resolveSectionCardClass(section, preset)
                }
              >
                <img
                  src={(item as { imageUrl: string }).imageUrl}
                  alt={(item as { description?: string }).description || section.title || "Gallery image"}
                  className={
                    count === 1
                      ? "w-full max-h-[32rem] object-cover"
                      : "h-56 w-full object-cover md:h-64"
                  }
                />
                {(item as { description?: string }).description ? (
                  <figcaption className="px-5 py-4 text-sm leading-6 text-slate-600">
                    {(item as { description: string }).description}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// Generic section renderer (fallback)
function GenericSection({ section, sectionIndex }: { section: SiteSection; sectionIndex: number }) {
  return (
    <section id={slugify(section.title)} {...SITE_SECTION_DATA_ATTRS(section, sectionIndex)} className={"px-4 py-20 sm:px-6 lg:px-8 " + resolveSectionBackground(section, preset)}>
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center mb-14">
          <h2 className={"text-3xl font-semibold tracking-tight md:text-5xl " + resolveSectionTitleClass(section, preset)}>{section.title}</h2>
          {section.body && <p className={"mt-5 text-lg leading-8 " + resolveSectionBodyClass(section, preset)}>{section.body}</p>}
        </div>
        {section.items?.some((item) => (item as { imageUrl?: string }).imageUrl) && (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {section.items
              .filter((item) => (item as { imageUrl?: string }).imageUrl)
              .map((item, i) => (
                <figure key={i} className={"overflow-hidden rounded-3xl border " + resolveSectionCardClass(section, preset)}>
                  <img
                    src={(item as { imageUrl: string }).imageUrl}
                    alt={item.title || "Product image"}
                    className="h-48 w-full object-cover"
                  />
                  {item.title ? (
                    <figcaption className="p-4 text-sm font-semibold text-slate-950">{item.title}</figcaption>
                  ) : null}
                </figure>
              ))}
          </div>
        )}
        {section.items && section.items.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {section.items.slice(0, 6).map((item, i) => (
              <div key={i} className={"rounded-3xl border p-7 shadow-sm " + resolveSectionCardClass(section, preset)}>
                <h3 className="text-lg font-bold text-slate-950">{item.title}</h3>
                {item.description && <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// Section router
function SectionRenderer({ section, sectionIndex }: { section: SiteSection; sectionIndex: number }) {
  switch (section.type) {
    case "services": return <ServicesSection section={section} sectionIndex={sectionIndex} />;
    case "about": return <AboutSection section={section} sectionIndex={sectionIndex} />;
    case "features": return <FeaturesSection section={section} sectionIndex={sectionIndex} />;
    case "faq": return <FaqSection section={section} sectionIndex={sectionIndex} />;
    case "testimonials": return <TestimonialsSection section={section} sectionIndex={sectionIndex} />;
    case "contact": return <ContactSection section={section} sectionIndex={sectionIndex} />;
    case "gallery": return <GallerySection section={section} sectionIndex={sectionIndex} />;
    default: return <GenericSection section={section} sectionIndex={sectionIndex} />;
  }
}

// Footer
function Footer() {
  return (
    <footer className={"px-4 py-8 sm:px-6 lg:px-8 " + preset.footerBg + " text-slate-400"}>
      <div className="mx-auto max-w-7xl">
        <p className="text-sm">© {new Date().getFullYear()} {siteConfig.businessName}. All rights reserved.</p>
      </div>
    </footer>
  );
}

// Main page component
export default function Home() {
  return (
    <main className={"min-h-screen " + preset.pageBg + " text-slate-950"}>
      <Nav />
      <Hero />
      {siteConfig.sections.map((section, index) => (
        <SectionRenderer key={section.type + "-" + index} section={section} sectionIndex={index} />
      ))}
      <Footer />
    </main>
  );
}
`;