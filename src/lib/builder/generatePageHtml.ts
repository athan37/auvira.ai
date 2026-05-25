import type { SiteSpec } from '../agent/schemas';

interface Preset {
  navBg: string;
  navText: string;
  heroHeadline: string;
  heroSubtext: string;
  heroBg: string;
  sectionHeading: string;
  sectionText: string;
  ctaBg: string;
  ctaText: string;
  buttonBg: string;
  buttonText: string;
  cardBorder: string;
  cardShadow: string;
  footerBg: string;
  footerText: string;
}

function getPreset(name: string): Preset {
  const presets: Record<string, Preset> = {
    'modern-clean': {
      navBg: 'bg-white shadow-sm', navText: 'text-gray-900',
      heroHeadline: 'text-5xl font-bold tracking-tight', heroSubtext: 'text-xl text-gray-500',
      heroBg: 'bg-white', sectionHeading: 'text-3xl font-bold', sectionText: 'text-gray-600',
      ctaBg: 'bg-indigo-600', ctaText: 'text-white', buttonBg: 'bg-indigo-600', buttonText: 'text-white',
      cardBorder: 'border-gray-200', cardShadow: 'shadow-sm',
      footerBg: 'bg-gray-900', footerText: 'text-gray-400',
    },
    'professional-bold': {
      navBg: 'bg-slate-900', navText: 'text-white',
      heroHeadline: 'text-6xl font-extrabold tracking-tighter', heroSubtext: 'text-2xl text-slate-300',
      heroBg: 'bg-slate-900', sectionHeading: 'text-4xl font-bold', sectionText: 'text-slate-600',
      ctaBg: 'bg-blue-600', ctaText: 'text-white', buttonBg: 'bg-blue-600', buttonText: 'text-white',
      cardBorder: 'border-slate-200', cardShadow: 'shadow-md',
      footerBg: 'bg-slate-950', footerText: 'text-slate-400',
    },
    'warm-premium': {
      navBg: 'bg-amber-900', navText: 'text-amber-50',
      heroHeadline: 'text-5xl font-bold', heroSubtext: 'text-xl text-amber-200',
      heroBg: 'bg-amber-950', sectionHeading: 'text-3xl font-bold', sectionText: 'text-stone-600',
      ctaBg: 'bg-amber-600', ctaText: 'text-white', buttonBg: 'bg-amber-600', buttonText: 'text-white',
      cardBorder: 'border-amber-200', cardShadow: 'shadow-lg',
      footerBg: 'bg-amber-950', footerText: 'text-amber-300',
    },
    'modern-minimal': {
      navBg: 'bg-transparent', navText: 'text-black',
      heroHeadline: 'text-7xl font-light tracking-tight', heroSubtext: 'text-2xl text-gray-400',
      heroBg: 'bg-white', sectionHeading: 'text-3xl font-light', sectionText: 'text-gray-500',
      ctaBg: 'bg-black', ctaText: 'text-white', buttonBg: 'bg-black', buttonText: 'text-white',
      cardBorder: 'border-gray-100', cardShadow: '',
      footerBg: 'bg-gray-50', footerText: 'text-gray-500',
    },
  };
  return presets[name] || presets['modern-clean'];
}

function sectionToHtml(section: SiteSpec['sections'][0], theme: Preset, index: number): string {
  const bgClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
  const items = Array.isArray(section.items) ? section.items : [];

  const itemsHtml = items.slice(0, 6).map((item: string) => `
    <div class="p-4 border ${theme.cardBorder} rounded-lg">
      <p class="text-sm text-gray-700">${escapeHtml(item)}</p>
    </div>
  `).join('');

  return `
    <section class="py-20 ${bgClass}">
      <div class="max-w-6xl mx-auto px-4">
        <h2 class="${theme.sectionHeading} text-gray-900 mb-4">${escapeHtml(section.title || '')}</h2>
        <p class="${theme.sectionText} text-lg mb-8 max-w-3xl">${escapeHtml(section.body || '')}</p>
        ${itemsHtml ? `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">${itemsHtml}</div>` : ''}
      </div>
    </section>
  `;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates a complete standalone HTML page from a SiteSpec.
 * This is used for fast preview rendering without a full Next.js build step.
 */
export function generatePageHtml(siteSpec: SiteSpec, projectName: string): string {
  const preset = getPreset(siteSpec.designDirection?.colors?.[0] || 'modern-clean');

  const navBg = preset.navBg;
  const navText = preset.navText;

  const heroSection = siteSpec.sections.find((s: any) => s.type === 'hero');
  const heroHeadline = heroSection?.title || siteSpec.siteTitle || projectName;
  const heroSubtext = heroSection?.body || siteSpec.tagline || '';

  const ctaSection = siteSpec.sections.find((s: any) => s.type === 'cta');
  const ctaText = ctaSection?.body || siteSpec.primaryCTA || 'Get Started';

  const sectionsHtml = siteSpec.sections
    .filter((s: any) => s.type !== 'hero' && s.type !== 'cta')
    .map((section: any, i: number) => sectionToHtml(section, preset, i))
    .join('');

  const footerText = siteSpec.sections.find((s: any) => s.type === 'footer');
  const phone = siteSpec.sections.find((s: any) => s.type === 'contact')?.items?.[0] || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(siteSpec.siteTitle || projectName)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  </style>
</head>
<body>
  <!-- Navigation -->
  <nav class="${navBg} ${navText} py-4 px-6 flex items-center justify-between">
    <div class="font-bold text-xl">${escapeHtml(siteSpec.siteTitle || projectName)}</div>
    <div class="flex items-center gap-6">
      <a href="#services" class="text-sm hover:opacity-80">Services</a>
      <a href="#about" class="text-sm hover:opacity-80">About</a>
      <a href="#contact" class="text-sm hover:opacity-80">Contact</a>
      <a href="#contact" class="px-4 py-2 ${preset.buttonBg} ${preset.buttonText} rounded-lg text-sm font-medium">${escapeHtml(ctaText)}</a>
    </div>
  </nav>

  <!-- Hero -->
  <section class="py-24 px-6 text-center" style="background: #f8fafc;">
    <h1 class="${preset.heroHeadline} text-gray-900 mb-4">${escapeHtml(heroHeadline)}</h1>
    <p class="${preset.heroSubtext} text-xl mb-8 max-w-2xl mx-auto">${escapeHtml(heroSubtext)}</p>
    <a href="#contact" class="inline-block px-8 py-3 ${preset.ctaBg} ${preset.ctaText} rounded-xl text-lg font-semibold">${escapeHtml(ctaText)}</a>
  </section>

  <!-- Content sections -->
  ${sectionsHtml}

  <!-- Contact CTA -->
  <section id="contact" class="py-20 px-6 bg-indigo-600 text-white text-center">
    <h2 class="text-3xl font-bold mb-4">Ready to get started?</h2>
    <p class="text-indigo-200 mb-8 max-w-xl mx-auto">${escapeHtml(siteSpec.secondaryCTA || 'Contact us today to learn more.')}</p>
    <a href="#contact" class="inline-block px-8 py-3 bg-white text-indigo-600 rounded-xl font-semibold">${escapeHtml(ctaText)}</a>
  </section>

  <!-- Footer -->
  <footer class="py-8 px-6 ${preset.footerBg} ${preset.footerText} text-center text-sm">
    <p>© ${new Date().getFullYear()} ${escapeHtml(siteSpec.siteTitle || projectName)} · ${escapeHtml(phone)}</p>
  </footer>
</body>
</html>`;
}