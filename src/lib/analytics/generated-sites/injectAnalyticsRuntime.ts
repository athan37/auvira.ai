import type { GeneratedFile } from '@/lib/builder/types';
import {
  ANALYTICS_ATTRS_PATH,
  ANALYTICS_CONFIG_PATH,
  ANALYTICS_RUNTIME_PATH,
  PAGE_PATH,
} from './analyticsConstants';
import {
  generateAnalyticsAttrsSource,
  generateAnalyticsConfigSource,
  generateWebsiteAnalyticsSource,
  type AnalyticsSourceTemplateInput,
} from './analyticsSourceTemplates';

function replaceOnce(content: string, search: string, replacement: string): string {
  const index = content.indexOf(search);
  if (index < 0) return content;
  return `${content.slice(0, index)}${replacement}${content.slice(index + search.length)}`;
}

function ensureImport(content: string): string {
  if (content.includes('@/components/analytics/WebsiteAnalytics')) return content;
  const importLine = 'import { WebsiteAnalytics } from "@/components/analytics/WebsiteAnalytics";\n';
  const siteConfigImport = 'import { siteConfig } from "@/lib/siteConfig";\n';
  if (content.includes(siteConfigImport)) {
    return content.replace(siteConfigImport, `${siteConfigImport}${importLine}`);
  }
  return `${importLine}${content}`;
}

function injectRuntimeComponent(content: string): string {
  if (content.includes('<WebsiteAnalytics />')) return content;
  const mainOpen = '<main className={"min-h-screen " + preset.pageBg + " text-slate-950"}>';
  return replaceOnce(content, mainOpen, `${mainOpen}\n      <WebsiteAnalytics />`);
}

function injectHeroAttrs(content: string): string {
  if (content.includes('data-analytics-id="hero"')) return content;
  return replaceOnce(
    content,
    '<section className={"relative overflow-hidden " + preset.heroBg + " px-4 py-24 text-white sm:px-6 lg:px-8 lg:py-32"}>',
    '<section data-analytics-id="hero" data-analytics-type="hero" data-analytics-label="Hero" className={"relative overflow-hidden " + preset.heroBg + " px-4 py-24 text-white sm:px-6 lg:px-8 lg:py-32"}>'
  );
}

function injectSectionAttrs(content: string): string {
  const sectionAttrs =
    'data-analytics-id={section.analyticsId || section.id || slugify(section.title)} data-analytics-type="section" data-analytics-label={section.title}';
  const replacements: Array<[string, string]> = [
    ['<section id="services" className=', `<section id="services" ${sectionAttrs} className=`],
    ['<section id="about" className=', `<section id="about" ${sectionAttrs} className=`],
    ['<section id="features" className=', `<section id="features" ${sectionAttrs} className=`],
    ['<section id="faq" className=', `<section id="faq" ${sectionAttrs} className=`],
    ['<section id="testimonials" className=', `<section id="testimonials" ${sectionAttrs} className=`],
    ['<section id="contact" className=', `<section id="contact" ${sectionAttrs} className=`],
    ['<section id="gallery" className=', `<section id="gallery" ${sectionAttrs} className=`],
    ['<section id={slugify(section.title)} className=', `<section id={slugify(section.title)} ${sectionAttrs} className=`],
  ];

  let out = content;
  for (const [search, replacement] of replacements) {
    if (out.includes(search)) {
      out = replaceOnce(out, search, replacement);
    }
  }
  return out;
}

function injectCtaAttrs(content: string): string {
  let out = content;

  out = replaceOnce(
    out,
    '<a href="#contact" className={"inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold " + preset.primaryButton}>',
    '<a href="#contact" data-analytics-id="cta_nav_primary" data-analytics-type="cta" data-analytics-label={siteConfig.hero.primaryCta || "Navigation CTA"} className={"inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold " + preset.primaryButton}>'
  );
  out = replaceOnce(
    out,
    '<a href="#contact" className={"inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold shadow-lg shadow-black/20 transition hover:-translate-y-0.5 " + preset.primaryButton}>{hero.primaryCta}</a>',
    '<a href="#contact" data-analytics-id="cta_hero_primary" data-analytics-type="cta" data-analytics-label={hero.primaryCta} className={"inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold shadow-lg shadow-black/20 transition hover:-translate-y-0.5 " + preset.primaryButton}>{hero.primaryCta}</a>'
  );
  out = replaceOnce(
    out,
    '<a href="#services" className={"inline-flex items-center justify-center rounded-full border-2 border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 " + preset.secondaryButton}>{hero.secondaryCta}</a>',
    '<a href="#services" data-analytics-id="cta_hero_secondary" data-analytics-type="cta" data-analytics-label={hero.secondaryCta} className={"inline-flex items-center justify-center rounded-full border-2 border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 " + preset.secondaryButton}>{hero.secondaryCta}</a>'
  );
  out = replaceOnce(
    out,
    '<a href="#contact" className={"inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold shadow-lg shadow-black/20 transition hover:-translate-y-0.5 " + preset.primaryButton}>{siteConfig.hero.primaryCta}</a>',
    '<a href="#contact" data-analytics-id="cta_contact_primary" data-analytics-type="cta" data-analytics-label={siteConfig.hero.primaryCta || "Contact CTA"} className={"inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold shadow-lg shadow-black/20 transition hover:-translate-y-0.5 " + preset.primaryButton}>{siteConfig.hero.primaryCta}</a>'
  );
  out = replaceOnce(
    out,
    '<a href={"tel:" + contact.phone.replace(/[^0-9]/g, "")} className={"inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 " + preset.secondaryButton}>{contact.phone}</a>',
    '<a href={"tel:" + contact.phone.replace(/[^0-9]/g, "")} data-analytics-id="cta_contact_phone" data-analytics-type="cta" data-analytics-label={contact.phone} className={"inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 " + preset.secondaryButton}>{contact.phone}</a>'
  );

  return out;
}

export function injectAnalyticsIntoPageSource(content: string): string {
  let out = ensureImport(content);
  out = injectRuntimeComponent(out);
  out = injectHeroAttrs(out);
  out = injectSectionAttrs(out);
  out = injectCtaAttrs(out);
  return out;
}

function upsertFile(files: GeneratedFile[], filePath: string, content: string): GeneratedFile[] {
  const existing = files.find((file) => file.filePath === filePath);
  if (existing) {
    if (existing.content === content) return files;
    return files.map((file) => (file.filePath === filePath ? { ...file, content } : file));
  }
  return [...files, { filePath, content }];
}

export function injectAnalyticsRuntimeFiles(
  files: GeneratedFile[],
  input: AnalyticsSourceTemplateInput
): GeneratedFile[] {
  let next = files;
  next = upsertFile(next, ANALYTICS_CONFIG_PATH, generateAnalyticsConfigSource(input));
  next = upsertFile(next, ANALYTICS_ATTRS_PATH, generateAnalyticsAttrsSource());
  next = upsertFile(next, ANALYTICS_RUNTIME_PATH, generateWebsiteAnalyticsSource());
  return next.map((file) =>
    file.filePath === PAGE_PATH
      ? { ...file, content: injectAnalyticsIntoPageSource(file.content) }
      : file
  );
}
