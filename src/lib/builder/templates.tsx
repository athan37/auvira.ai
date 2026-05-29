import type { SiteSpec, DesignBrief } from '../agent/schemas';
import type { GeneratedFile } from './types';
import { pickBackgroundColor, extractCssColor } from './cssColor';
import { SITE_CONFIG_TYPE_BLOCK } from './siteConfigTypes';
import { tailwindContentPathsForGeneratedSite } from './tailwindPresentationSupport';

// Hardcoded premium theme presets by industry
// These are SAFE, PREDEFINED themes - no LLM arbitrary classes
export type HeroStyle = 'split' | 'centered' | 'phone-first' | 'menu-feature' | 'appointment-hero';
export type CtaStyle = 'hero-heavy' | 'repeated' | 'inline' | 'emergency-banner';
export type TrustSectionType = 'none' | 'credentials-bar' | 'reviews-carousel' | 'insurance-logos' | 'service-area-map';

export interface IndustryTheme {
  // Page backgrounds
  pageBg: string;
  surfaceBg: string;
  mutedBg: string;
  // Dark backgrounds
  darkBg: string;
  darkBg2: string;
  // Text colors
  primaryText: string;
  mutedText: string;
  inverseText: string;
  accentText: string;
  // Accent colors
  accentBg: string;
  accentBgHover: string;
  accentSoftBg: string;
  accentBorder: string;
  // Borders and cards
  border: string;
  card: string;
  premiumCard: string;
  // Hero
  heroBg: string;
  heroPattern: string;
  // Buttons
  primaryButton: string;
  secondaryButton: string;
  lightButton: string;
  // Misc
  sectionEyebrow: string;
  footerBg: string;
  // Nav
  navBg: string;
  navBorder: string;
  navText: string;

  // === STRUCTURAL FIELDS ===
  heroStyle: HeroStyle;
  ctaStyle: CtaStyle;
  trustSection: TrustSectionType;
  sectionOrder: string[];
  contentBias: string;
}

const themes: Record<string, IndustryTheme> = {
  legal: {
    pageBg: 'bg-[#F8F4EC]',
    surfaceBg: 'bg-[#FFFCF7]',
    mutedBg: 'bg-[#EFE7DA]',
    darkBg: 'bg-[#0B1220]',
    darkBg2: 'bg-[#111827]',
    primaryText: 'text-[#0B1220]',
    mutedText: 'text-slate-600',
    inverseText: 'text-white',
    accentText: 'text-[#C89B3C]',
    accentBg: 'bg-[#C89B3C]',
    accentBgHover: 'hover:bg-[#B8892F]',
    accentSoftBg: 'bg-[#F3E4C2]',
    accentBorder: 'border-[#D8B866]',
    border: 'border-[#E5D8C2]',
    card: 'bg-[#FFFCF7] border border-[#E5D8C2] shadow-sm',
    premiumCard: 'bg-white/95 border border-[#E5D8C2] shadow-xl shadow-slate-900/5',
    heroBg: 'bg-[radial-gradient(circle_at_top_left,#1E293B_0%,#0B1220_45%,#050816_100%)]',
    heroPattern: 'before:absolute before:inset-0 before:bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] before:bg-[size:48px_48px] before:opacity-20',
    primaryButton: 'bg-[#C89B3C] text-[#0B1220] hover:bg-[#E0B85A] shadow-lg shadow-amber-900/20 font-semibold',
    secondaryButton: 'border-2 border-white/30 text-white hover:bg-white/10 font-semibold',
    lightButton: 'bg-[#0B1220] text-white hover:bg-[#111827]',
    sectionEyebrow: 'text-[#9A6B16] uppercase tracking-[0.25em] text-xs font-semibold',
    footerBg: 'bg-[#050816] text-slate-300',
    navBg: 'bg-[#FFFCF7]/95 backdrop-blur-md',
    navBorder: 'border-[#E5D8C2]',
    navText: 'text-[#0B1220]',
    // Structural
    heroStyle: 'split',
    ctaStyle: 'repeated',
    trustSection: 'credentials-bar',
    sectionOrder: ['hero', 'credibility-bar', 'practice-areas', 'about', 'testimonials', 'contact', 'consultation'],
    contentBias: 'Legal template: credibility signals (years experience, cases won, credentials) must be prominent. Practice areas as organized grid. Firm reputation/attorneys section. Consultation CTA in hero and repeated. Never use phone-first hero — professional split hero required.',
  },
  healthcare: {
    pageBg: 'bg-[#F0FDFA]',
    surfaceBg: 'bg-white',
    mutedBg: 'bg-[#CCFBF1]',
    darkBg: 'bg-[#134E4A]',
    darkBg2: 'bg-[#0F3D3D]',
    primaryText: 'text-[#134E4A]',
    mutedText: 'text-teal-700/70',
    inverseText: 'text-white',
    accentText: 'text-[#0891B2]',
    accentBg: 'bg-[#0891B2]',
    accentBgHover: 'hover:bg-[#0E7490]',
    accentSoftBg: 'bg-[#CFFAFE]',
    accentBorder: 'border-[#67D7E5]',
    border: 'border-teal-200',
    card: 'bg-white border border-teal-200 shadow-sm',
    premiumCard: 'bg-white/95 border border-teal-200 shadow-xl shadow-teal-900/5',
    heroBg: 'bg-[radial-gradient(circle_at_top_right,#134E4A_0%,#0F3D3D_50%,#0A2E2E_100%)]',
    heroPattern: 'before:absolute before:inset-0 before:bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] before:bg-[size:48px_48px] before:opacity-30',
    primaryButton: 'bg-[#0891B2] text-white hover:bg-[#0E7490] shadow-lg shadow-teal-900/20 font-semibold',
    secondaryButton: 'border-2 border-white/30 text-white hover:bg-white/10 font-semibold',
    lightButton: 'bg-[#134E4A] text-white hover:bg-[#0F3D3D]',
    sectionEyebrow: 'text-[#0891B2] uppercase tracking-[0.25em] text-xs font-semibold',
    footerBg: 'bg-[#0A2E2E] text-teal-100',
    navBg: 'bg-white/95 backdrop-blur-md',
    navBorder: 'border-teal-200',
    navText: 'text-[#134E4A]',
    // Structural
    heroStyle: 'appointment-hero',
    ctaStyle: 'repeated',
    trustSection: 'insurance-logos',
    sectionOrder: ['hero', 'providers', 'services', 'insurance', 'about', 'contact'],
    contentBias: 'Healthcare template: appointment booking CTA must be most prominent element. Provider/staff section with credentials. Insurance accepted info clearly shown. Board certifications and trust signals. Calm, clinical visual feel. Phone and address visible.',
  },
  'home-services': {
    pageBg: 'bg-[#F0F9FF]',
    surfaceBg: 'bg-white',
    mutedBg: 'bg-[#E0F2FE]',
    darkBg: 'bg-[#0C4A6E]',
    darkBg2: 'bg-[#075985]',
    primaryText: 'text-[#0C4A6E]',
    mutedText: 'text-sky-700/70',
    inverseText: 'text-white',
    accentText: 'text-[#0284C7]',
    accentBg: 'bg-[#0284C7]',
    accentBgHover: 'hover:bg-[#0369A1]',
    accentSoftBg: 'bg-[#BAE6FD]',
    accentBorder: 'border-[#7DD3FC]',
    border: 'border-sky-200',
    card: 'bg-white border border-sky-200 shadow-sm',
    premiumCard: 'bg-white/95 border border-sky-200 shadow-xl shadow-sky-900/5',
    heroBg: 'bg-[radial-gradient(circle_at_top_right,#0C4A6E_0%,#0369A1_50%,#075985_100%)]',
    heroPattern: 'before:absolute before:inset-0 before:bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] before:bg-[size:48px_48px] before:opacity-25',
    primaryButton: 'bg-[#0284C7] text-white hover:bg-[#0369A1] shadow-lg shadow-sky-900/20 font-semibold',
    secondaryButton: 'border-2 border-white/30 text-white hover:bg-white/10 font-semibold',
    lightButton: 'bg-[#0C4A6E] text-white hover:bg-[#075985]',
    sectionEyebrow: 'text-[#0284C7] uppercase tracking-[0.25em] text-xs font-semibold',
    footerBg: 'bg-[#0C4A6E] text-sky-100',
    navBg: 'bg-white/95 backdrop-blur-md',
    navBorder: 'border-sky-200',
    navText: 'text-[#0C4A6E]',
    // Structural
    heroStyle: 'phone-first',
    ctaStyle: 'emergency-banner',
    trustSection: 'reviews-carousel',
    sectionOrder: ['hero', 'emergency-banner', 'services', 'why-choose', 'reviews', 'service-area', 'contact', 'quote-form'],
    contentBias: 'Home services template: phone number must be massive and above-fold in hero with click-to-call. 24/7 emergency service banner below nav. Service cards with icons. Service area coverage section. Quote request form. Trust badges (licensed, insured, reviews). Phone CTA in nav.',
  },
  restaurant: {
    pageBg: 'bg-[#FFFBEB]',
    surfaceBg: 'bg-white',
    mutedBg: 'bg-[#FEF3C7]',
    darkBg: 'bg-[#7C2D12]',
    darkBg2: 'bg-[#9A3412]',
    primaryText: 'text-[#7C2D12]',
    mutedText: 'text-orange-800/70',
    inverseText: 'text-white',
    accentText: 'text-[#EA580C]',
    accentBg: 'bg-[#EA580C]',
    accentBgHover: 'hover:bg-[#DC2626]',
    accentSoftBg: 'bg-[#FED7AA]',
    accentBorder: 'border-[#FCA5A5]',
    border: 'border-orange-200',
    card: 'bg-white border border-orange-200 shadow-sm',
    premiumCard: 'bg-white/95 border border-orange-200 shadow-xl shadow-orange-900/5',
    heroBg: 'bg-[radial-gradient(circle_at_top_left,#9A3412_0%,#7C2D12_50%,#5C1D0E_100%)]',
    heroPattern: 'before:absolute before:inset-0 before:bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] before:bg-[size:48px_48px] before:opacity-20',
    primaryButton: 'bg-[#EA580C] text-white hover:bg-[#DC2626] shadow-lg shadow-orange-900/20 font-semibold',
    secondaryButton: 'border-2 border-white/30 text-white hover:bg-white/10 font-semibold',
    lightButton: 'bg-[#7C2D12] text-white hover:bg-[#9A3412]',
    sectionEyebrow: 'text-[#EA580C] uppercase tracking-[0.25em] text-xs font-semibold',
    footerBg: 'bg-[#5C1D0E] text-orange-100',
    navBg: 'bg-white/95 backdrop-blur-md',
    navBorder: 'border-orange-200',
    navText: 'text-[#7C2D12]',
    // Structural
    heroStyle: 'menu-feature',
    ctaStyle: 'inline',
    trustSection: 'none',
    sectionOrder: ['hero', 'hours-location', 'menu-highlight', 'about', 'gallery', 'contact'],
    contentBias: 'Restaurant template: hours and location must be prominently displayed near top. Menu or featured dishes section. Food gallery section. Reservation or order CTA inline in relevant sections. Do not use phone-first hero. Appetizing visual treatment.',
  },
  default: {
    pageBg: 'bg-white',
    surfaceBg: 'bg-white',
    mutedBg: 'bg-slate-50',
    darkBg: 'bg-slate-900',
    darkBg2: 'bg-slate-800',
    primaryText: 'text-slate-900',
    mutedText: 'text-slate-600',
    inverseText: 'text-white',
    accentText: 'text-blue-600',
    accentBg: 'bg-blue-600',
    accentBgHover: 'hover:bg-blue-700',
    accentSoftBg: 'bg-blue-50',
    accentBorder: 'border-blue-300',
    border: 'border-slate-200',
    card: 'bg-white border border-slate-200 shadow-sm',
    premiumCard: 'bg-white border border-slate-200 shadow-xl',
    heroBg: 'bg-gradient-to-br from-slate-900 to-slate-800',
    heroPattern: 'before:absolute before:inset-0 before:bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] before:bg-[size:48px_48px] before:opacity-20',
    primaryButton: 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg font-semibold',
    secondaryButton: 'border-2 border-white/30 text-white hover:bg-white/10 font-semibold',
    lightButton: 'bg-slate-900 text-white hover:bg-slate-800',
    sectionEyebrow: 'text-blue-600 uppercase tracking-[0.25em] text-xs font-semibold',
    footerBg: 'bg-slate-900 text-slate-300',
    navBg: 'bg-white/95 backdrop-blur-md',
    navBorder: 'border-slate-200',
    navText: 'text-slate-900',
    // Structural
    heroStyle: 'split',
    ctaStyle: 'repeated',
    trustSection: 'none',
    sectionOrder: ['hero', 'services', 'about', 'testimonials', 'contact'],
    contentBias: 'General service template: clean professional layout with services grid, about section, testimonials, and contact. Balanced CTAs. No special structural requirements.',
  },
  'general-service': {
    pageBg: 'bg-white',
    surfaceBg: 'bg-white',
    mutedBg: 'bg-slate-50',
    darkBg: 'bg-slate-900',
    darkBg2: 'bg-slate-800',
    primaryText: 'text-slate-900',
    mutedText: 'text-slate-600',
    inverseText: 'text-white',
    accentText: 'text-blue-600',
    accentBg: 'bg-blue-600',
    accentBgHover: 'hover:bg-blue-700',
    accentSoftBg: 'bg-blue-50',
    accentBorder: 'border-blue-300',
    border: 'border-slate-200',
    card: 'bg-white border border-slate-200 shadow-sm',
    premiumCard: 'bg-white border border-slate-200 shadow-xl',
    heroBg: 'bg-gradient-to-br from-slate-900 to-slate-800',
    heroPattern: 'before:absolute before:inset-0 before:bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] before:bg-[size:48px_48px] before:opacity-20',
    primaryButton: 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg font-semibold',
    secondaryButton: 'border-2 border-white/30 text-white hover:bg-white/10 font-semibold',
    lightButton: 'bg-slate-900 text-white hover:bg-slate-800',
    sectionEyebrow: 'text-blue-600 uppercase tracking-[0.25em] text-xs font-semibold',
    footerBg: 'bg-slate-900 text-slate-300',
    navBg: 'bg-white/95 backdrop-blur-md',
    navBorder: 'border-slate-200',
    navText: 'text-slate-900',
    // Structural
    heroStyle: 'split',
    ctaStyle: 'repeated',
    trustSection: 'none',
    sectionOrder: ['hero', 'services', 'about', 'testimonials', 'contact'],
    contentBias: 'General service template: clean professional layout with services grid, about section, testimonials, and contact. Balanced CTAs. No special structural requirements.',
  },
};

export function getIndustryTheme(designBrief?: DesignBrief): IndustryTheme {
  const industry = designBrief?.industryTheme || 'default';
  return themes[industry] || themes['default'];
}

export { themes };

function detectIndustry(siteSpec: SiteSpec): string {
  const combined = JSON.stringify(siteSpec).toLowerCase();
  if (combined.includes('law') || combined.includes('attorney') || combined.includes('legal')) return 'legal';
  if (combined.includes('doctor') || combined.includes('medical') || combined.includes('health') || combined.includes('clinic')) return 'healthcare';
  if (combined.includes('restaurant') || combined.includes('cafe') || combined.includes('food') || combined.includes('menu')) return 'restaurant';
  if (combined.includes('plumbing') || combined.includes('hvac') || combined.includes('roof') || combined.includes('contractor') || combined.includes('electric')) return 'home-services';
  return 'default';
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function t(key: keyof IndustryTheme, theme: IndustryTheme): string {
  return theme[key] as string;
}

export function generatePackageJson(projectName: string): string {
  return JSON.stringify({
    name: projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
    },
    dependencies: {
      next: '^14.0.0',
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      typescript: '^5.0.0',
      tailwindcss: '^3.4.0',
      postcss: '^8.4.0',
      autoprefixer: '^10.4.0',
    }
  }, null, 2);
}

export function generateTailwindConfig(designBrief?: DesignBrief): string {
  const cp = designBrief?.colorPalette;
  const primary = cp?.primary || '#0ea5e9';
  const secondary = cp?.secondary || '#0369a1';
  const accent = cp?.accent || '#0d9488';

  const generateShades = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [
      { suffix: '50', opacity: '0.05' },
      { suffix: '100', opacity: '0.1' },
      { suffix: '200', opacity: '0.2' },
      { suffix: '300', opacity: '0.3' },
      { suffix: '400', opacity: '0.4' },
      { suffix: '500', opacity: '0.5' },
      { suffix: '600', opacity: '0.6' },
      { suffix: '700', opacity: '0.7' },
      { suffix: '800', opacity: '0.8' },
      { suffix: '900', opacity: '0.9' },
    ].map(s => `        '${s.suffix}': 'rgb(${r} ${g} ${b} / ${s.opacity})'`).join(',\n');
  };

  return `/** @type {import('tailwindcss').Config} */
module.exports = {
${tailwindContentPathsForGeneratedSite()}
  theme: {
    extend: {
      colors: {
        primary: {
${generateShades(primary)}
        },
        secondary: {
${generateShades(secondary)}
        },
        accent: {
${generateShades(accent)}
        },
      },
    },
  },
  plugins: [],
}
`;
}

export function generatePostcssConfig(): string {
  return `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
}

export function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'es5',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./src/*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  }, null, 2);
}

export function generateNextConfig(): string {
  return `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
}
module.exports = nextConfig
`;
}

export function generateGitLabCiYml(): string {
  return `image: node:20

pages:
  stage: deploy
  script:
    - npm ci
    - npm run build
    - mkdir -p public
    - cp -r out/* public/
  artifacts:
    paths:
      - public
  only:
    - main
`;
}

/**
 * Generates siteConfig.ts with typed business data.
 * All business content lives here - page.tsx only renders it.
 */
export function generateSiteConfig(siteSpec: SiteSpec): string {
  // Extract contact info from sections
  const contactItems = siteSpec.sections.find(s => s.type === 'contact')?.items || [];
  const phoneItem = contactItems.find(i => i.toLowerCase().includes('phone') || i.includes('(')) || '';
  const emailItem = contactItems.find(i => i.includes('@')) || '';

  // Build hero from siteSpec (hero section title wins over siteTitle for headline)
  const heroSection = siteSpec.sections.find(s => s.type === 'hero');
  const headline =
    heroSection?.title?.trim() || siteSpec.siteTitle?.trim() || 'Business Website';
  const hero = {
    headline,
    subheadline: siteSpec.tagline,
    eyebrow: heroSection?.body?.split(' ').slice(0, 8).join(' ') || undefined,
    primaryCta: siteSpec.primaryCTA,
    secondaryCta: siteSpec.secondaryCTA,
  };

  // Build sections array (excluding hero, using proper types)
  const sectionTypeMap: Record<string, string> = {
    services: 'services',
    about: 'about',
    features: 'features',
    faq: 'faq',
    testimonials: 'testimonials',
    contact: 'contact',
  };

  const sections = siteSpec.sections
    .filter(s => s.type !== 'hero')
    .map(s => ({
      type: (sectionTypeMap[s.type] || 'generic') as 'services' | 'about' | 'features' | 'faq' | 'testimonials' | 'contact' | 'generic',
      title: s.title,
      body: s.body,
      items: (s.items as unknown as Array<{title: string; description?: string}>).map(item => {
        // SiteSpec items are strings, SiteConfig items are objects with title/description
        if (typeof item === 'string') {
          return { title: item };
        }
        return { title: item.title, description: item.description };
      }),
    }));

  const siteConfig = {
    businessName: siteSpec.siteTitle,
    tagline: siteSpec.tagline,
    description: siteSpec.tagline,
    hero,
    contact: {
      phone: phoneItem || undefined,
      email: emailItem || undefined,
    },
    sections,
  };

  const siteConfigJson = JSON.stringify(siteConfig, null, 2);

  return `// Site configuration - business content only
// This file is auto-generated. Edits will be overwritten.

${SITE_CONFIG_TYPE_BLOCK}

export const siteConfig: SiteConfig = ${siteConfigJson};
`;
}

export function generateLayoutTsx(): string {
  return `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Business Website',
  description: 'Modern business website',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
`;
}

export function generateGlobalsCss(designBrief?: DesignBrief, siteSpecColors?: string[]): string {
  const theme = getIndustryTheme(designBrief);
  const themeBg = extractCssColor(theme.pageBg.replace('bg-[', '').replace(']', '')) || '#F8FAFC';
  const bodyBg = pickBackgroundColor(siteSpecColors, themeBg);
  const textColor =
    extractCssColor(theme.primaryText.replace('text-[', '').replace(']', '')) || '#0f172a';
  const selectionBg =
    extractCssColor(theme.accentBg.replace('bg-[', '').replace(']', '')) || '#0284C7';
  const selectionText =
    extractCssColor(theme.darkBg.replace('bg-[', '').replace(']', '')) || '#0C4A6E';
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
}

html {
  scroll-behavior: smooth;
}

body {
  background: ${bodyBg};
  color: ${textColor};
}

::selection {
  background: ${selectionBg};
  color: ${selectionText};
}

a {
  text-underline-offset: 4px;
}
`;
}

import { PAGE_TSX_TEMPLATE } from './pageTemplate';

/**
 * Fixed data-driven page renderer.
 * Uses a pre-defined template with only preset JSON substitution.
 */
export function generatePageTsx(
  _siteSpec: SiteSpec,
  _designBrief?: DesignBrief,
  _theme?: IndustryTheme,
  presetJson?: string
): string {
  // Only the preset JSON is injected - all business content comes from siteConfig
  const preset = presetJson ? presetJson : '{}';

  return PAGE_TSX_TEMPLATE.replace('__PRESET_JSON__', preset);
}


export function generateReadme(projectName: string, siteSpec: SiteSpec): string {
  return `# ${siteSpec.siteTitle}

${siteSpec.tagline}

## About
This website was generated using AI Website Migration Agent.

## Deployment
This site is deployed via **Vercel**. Vercel clones the GitLab repository and runs:

\`\`\`bash
npm install
npm run build
\`\`\`

## GitLab
This repository stores version history and commits. **GitLab CI is intentionally not used** - deployment is handled exclusively by Vercel.

## Sections
${siteSpec.sections.map(s => `- ${s.title} (${s.type})`).join('\n')}

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Visit http://localhost:3000 to view your website.

## Troubleshooting

### Deployment not available immediately
After triggering a deploy, the live URL may take 1-3 minutes to become available. If you see "Deployment not found", wait and refresh.

### Confirm GitLab connection in Vercel
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings > Git
4. Confirm the GitLab repository is connected

### VERCEL_TEAM_ID
If deployments are failing, confirm the VERCEL_TEAM_ID matches the account/team where your GitLab account is connected.
`;
}

/**
 * Safe fallback template - simple one-page site with no dynamic theming.
 * Uses fixed premium theme (navy/ivory/gold) guaranteed to build.
 */
export function generateSafeFallbackPageTsx(siteSpec: SiteSpec): string {
  return `
import { siteConfig } from "@/lib/siteConfig";

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F8F4EC] text-slate-950">
      <nav className="sticky top-0 z-50 border-b border-[#E5D8C2] bg-[#FFFCF7]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="#" className="font-serif text-xl font-bold tracking-tight text-slate-950">{siteConfig.siteTitle}</a>
          <a href="#contact" className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800">
            {siteConfig.primaryCTA}
          </a>
        </div>
      </nav>

      <section className="bg-[radial-gradient(circle_at_top_left,#1E293B_0%,#0B1220_45%,#050816_100%)] px-4 py-24 text-white sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <h1 className="font-serif text-5xl font-semibold tracking-tight md:text-7xl">{siteConfig.siteTitle}</h1>
          <p className="mt-6 max-w-2xl text-xl leading-9 text-slate-300">{siteConfig.tagline}</p>
          <a href="#contact" className="mt-9 inline-flex items-center justify-center rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-900/20 transition hover:-translate-y-0.5 hover:bg-amber-300">
            {siteConfig.primaryCTA}
          </a>
        </div>
      </section>

      {siteConfig.sections.filter((s: any) => s.type !== "hero").map((section: any) => (
        <section key={section.title} id={slugify(section.title)} className="bg-[#FFFCF7] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">{section.body}</p>
            <div className="mt-8 space-y-3">
              {section.items.slice(0, 6).map((item) => (
                <div key={item} className="rounded-xl border border-[#E5D8C2] bg-white p-4 text-sm text-slate-700">{item}</div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section id="contact" className="bg-[#0B1220] px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-serif text-4xl font-semibold text-white">Contact Us</h2>
          <p className="mt-4 text-lg text-slate-300">{siteConfig.primaryCTA}</p>
          <a href="#contact" className="mt-6 inline-flex items-center justify-center rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300">
            Get Started
          </a>
        </div>
      </section>

      <footer className="bg-[#050816] px-4 py-8 text-slate-400 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm">© {new Date().getFullYear()} {siteConfig.siteTitle}. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
`;
}

export function generateSafeFallbackWebsiteFiles(
  siteSpec: SiteSpec,
  projectName: string
): GeneratedFile[] {
  return [
    {
      filePath: 'package.json',
      content: generatePackageJson(projectName),
    },
    {
      filePath: 'tailwind.config.js',
      content: generateTailwindConfig(),
    },
    {
      filePath: 'postcss.config.js',
      content: generatePostcssConfig(),
    },
    {
      filePath: 'tsconfig.json',
      content: generateTsConfig(),
    },
    {
      filePath: 'next.config.js',
      content: generateNextConfig(),
    },
    {
      filePath: 'src/lib/siteConfig.ts',
      content: generateSiteConfig(siteSpec),
    },
    {
      filePath: 'src/app/layout.tsx',
      content: generateLayoutTsx(),
    },
    {
      filePath: 'src/app/globals.css',
      content: generateGlobalsCss(),
    },
    {
      filePath: 'src/app/page.tsx',
      content: generateSafeFallbackPageTsx(siteSpec),
    },
    {
      filePath: 'README.md',
      content: generateReadme(projectName, siteSpec),
    },
  ];
}