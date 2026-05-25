import type { DesignDirection } from '@/lib/agent/schemas';

interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

function getDesignTokens(designDirection: DesignDirection): ColorPalette & { fontHeading: string; fontBody: string } {
  const colors = designDirection.colors || [];
  const tone = designDirection.tone || 'professional';
  const visualStyle = tone; // maps to visualStyle in design brief

  // Default palettes based on tone/visualStyle
  const palettes: Record<string, ColorPalette> = {
    'premium-professional': {
      primary: '#1e3a5f', secondary: '#2563eb', accent: '#f59e0b',
      background: '#ffffff', surface: '#f8fafc', text: '#1e293b', textMuted: '#64748b',
    },
    'warm-local': {
      primary: '#92400e', secondary: '#d97706', accent: '#10b981',
      background: '#fffbeb', surface: '#fef3c7', text: '#451a03', textMuted: '#78350f',
    },
    'modern-minimal': {
      primary: '#000000', secondary: '#374151', accent: '#000000',
      background: '#ffffff', surface: '#f9fafb', text: '#000000', textMuted: '#6b7280',
    },
    'bold-conversion': {
      primary: '#dc2626', secondary: '#ef4444', accent: '#fbbf24',
      background: '#ffffff', surface: '#fef2f2', text: '#1f2937', textMuted: '#6b7280',
    },
    'calm-healthcare': {
      primary: '#0f766e', secondary: '#14b8a6', accent: '#38bdf8',
      background: '#f0fdfa', surface: '#ccfbf1', text: '#134e4a', textMuted: '#5eead4',
    },
    'luxury-service': {
      primary: '#1e1b4b', secondary: '#4338ca', accent: '#fbbf24',
      background: '#fafafa', surface: '#f5f3ff', text: '#1e1b4b', textMuted: '#6b7280',
    },
    'professional': {
      primary: '#1e40af', secondary: '#3b82f6', accent: '#f59e0b',
      background: '#ffffff', surface: '#eff6ff', text: '#1e293b', textMuted: '#64748b',
    },
    'general-service': {
      primary: '#1d4ed8', secondary: '#3b82f6', accent: '#10b981',
      background: '#ffffff', surface: '#f0f9ff', text: '#0f172a', textMuted: '#475569',
    },
  };

  // Use first color to create a custom palette if we have specific colors
  let palette = palettes[visualStyle] || palettes['professional'];
  if (colors.length >= 3) {
    const primary = colors[0];
    const secondary = colors[1] || colors[0];
    const accent = colors[2] || '#f59e0b';
    palette = {
      primary,
      secondary,
      accent,
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#1e293b',
      textMuted: '#64748b',
    };
  }

  // Font choices
  const fontPairs: Record<string, { heading: string; body: string }> = {
    'serif-professional': { heading: 'Playfair Display, Georgia, serif', body: 'Source Sans Pro, -apple-system, sans-serif' },
    'sans-modern': { heading: 'Inter, -apple-system, sans-serif', body: 'Inter, -apple-system, sans-serif' },
    'editorial-premium': { heading: 'Playfair Display, Georgia, serif', body: 'Lora, Georgia, serif' },
    'default': { heading: 'system-ui, -apple-system, sans-serif', body: 'system-ui, -apple-system, sans-serif' },
  };

  const fonts = fontPairs['default'];

  return {
    ...palette,
    fontHeading: fonts.heading,
    fontBody: fonts.body,
  };
}

export function generatePreviewCss(siteSpec: { designDirection?: DesignDirection }): string {
  const tokens = getDesignTokens(siteSpec.designDirection || { tone: 'professional', layout: 'standard', colors: [] });
  const { primary, secondary, accent, background, surface, text, textMuted, fontHeading, fontBody } = tokens;

  const rgb = hexToRgb(primary) || { r: 30, g: 64, b: 175 };
  const rgbSecondary = hexToRgb(secondary) || { r: 59, g: 130, b: 246 };
  const rgbAccent = hexToRgb(accent) || { r: 245, g: 158, b: 11 };

  return `
/* ===== RESET & BASE ===== */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: ${fontBody};
  background: ${background};
  color: ${text};
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
img { max-width: 100%; height: auto; display: block; }
a { color: inherit; text-decoration: none; }
button { cursor: pointer; font-family: inherit; }

/* ===== LAYOUT ===== */
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.section { padding: 80px 0; }
.section--alt { background: ${surface}; }
.section__title {
  font-family: ${fontHeading};
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 700;
  color: ${text};
  margin-bottom: 16px;
  line-height: 1.2;
}
.section__subtitle {
  font-size: 1.125rem;
  color: ${textMuted};
  max-width: 640px;
  margin-bottom: 48px;
}
.section__header { text-align: center; margin-bottom: 48px; }
.section__header .section__subtitle { margin: 0 auto; }

/* ===== HEADER/NAV ===== */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(0,0,0,0.06);
  padding: 16px 0;
}
.header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header__logo {
  font-family: ${fontHeading};
  font-size: 1.25rem;
  font-weight: 700;
  color: ${primary};
}
.header__nav { display: flex; align-items: center; gap: 32px; }
.header__nav a {
  font-size: 0.875rem;
  font-weight: 500;
  color: ${textMuted};
  transition: color 0.2s;
}
.header__nav a:hover { color: ${primary}; }
.header__cta {
  background: ${primary};
  color: white !important;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600 !important;
  transition: background 0.2s;
}
.header__cta:hover { background: rgb(${rgb.r - 20},${rgb.g - 20},${rgb.b - 20}); }

/* ===== HERO ===== */
.hero {
  padding: 100px 0 80px;
  background: linear-gradient(135deg, ${primary} 0%, ${secondary} 100%);
  color: white;
  position: relative;
  overflow: hidden;
}
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 30% 50%, rgba(255,255,255,0.08) 0%, transparent 60%);
}
.hero__inner {
  position: relative;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 48px;
  align-items: center;
}
.hero__eyebrow {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${accent};
  margin-bottom: 16px;
}
.hero__title {
  font-family: ${fontHeading};
  font-size: clamp(2.5rem, 6vw, 4rem);
  font-weight: 700;
  line-height: 1.1;
  margin-bottom: 24px;
}
.hero__subtitle {
  font-size: 1.25rem;
  opacity: 0.85;
  line-height: 1.6;
  margin-bottom: 32px;
}
.hero__actions { display: flex; flex-wrap: wrap; gap: 16px; }
.hero__card {
  background: white;
  color: ${text};
  padding: 40px;
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
}
.hero__card-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: ${secondary};
  margin-bottom: 12px;
}
.hero__card-title {
  font-family: ${fontHeading};
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 12px;
}
.hero__card-text { color: ${textMuted}; font-size: 0.9375rem; line-height: 1.6; }

/* ===== BUTTONS ===== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 28px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.2s;
  border: none;
  text-align: center;
}
.btn--primary {
  background: ${primary};
  color: white;
  box-shadow: 0 4px 14px rgba(${rgb.r},${rgb.g},${rgb.b},0.4);
}
.btn--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(${rgb.r},${rgb.g},${rgb.b},0.5);
}
.btn--secondary {
  background: transparent;
  color: white;
  border: 2px solid rgba(255,255,255,0.3);
}
.btn--secondary:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.5); }
.btn--accent {
  background: ${accent};
  color: ${text};
  box-shadow: 0 4px 14px rgba(${rgbAccent.r},${rgbAccent.g},${rgbAccent.b},0.4);
}
.btn--accent:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(${rgbAccent.r},${rgbAccent.g},${rgbAccent.b},0.5);
}
.btn--outline {
  background: transparent;
  color: ${primary};
  border: 2px solid ${primary};
}
.btn--outline:hover { background: ${primary}; color: white; }

/* ===== SERVICE GRID ===== */
.service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}
.service-card {
  background: white;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 16px;
  padding: 32px;
  transition: all 0.3s;
}
.service-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.08);
}
.service-card__icon {
  width: 48px;
  height: 48px;
  background: ${surface};
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  color: ${secondary};
}
.service-card__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 8px;
}
.service-card__text { font-size: 0.9375rem; color: ${textMuted}; line-height: 1.6; }

/* ===== ABOUT/WHY CHOOSE ===== */
.about-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
}
.about-card {
  padding: 28px;
  border-radius: 16px;
  transition: transform 0.2s;
}
.about-card:hover { transform: translateY(-2px); }
.about-card--filled {
  background: white;
  border: 1px solid rgba(0,0,0,0.06);
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
}
.about-card__title {
  font-size: 1.0625rem;
  font-weight: 600;
  margin-bottom: 8px;
}
.about-card__text { font-size: 0.9375rem; color: ${textMuted}; }

/* ===== TESTIMONIALS ===== */
.testimonial-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}
.testimonial-card {
  background: white;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 16px;
  padding: 32px;
}
.testimonial-card__stars { color: ${accent}; margin-bottom: 16px; font-size: 1.125rem; }
.testimonial-card__quote {
  font-size: 1rem;
  line-height: 1.7;
  color: ${text};
  margin-bottom: 20px;
  font-style: italic;
}
.testimonial-card__author { display: flex; align-items: center; gap: 12px; }
.testimonial-card__avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: ${surface};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: ${primary};
}
.testimonial-card__name { font-weight: 600; font-size: 0.9375rem; }
.testimonial-card__role { font-size: 0.8125rem; color: ${textMuted}; }

/* ===== FAQ ===== */
.faq-list { max-width: 800px; margin: 0 auto; }
.faq-item {
  border-bottom: 1px solid rgba(0,0,0,0.08);
  padding: 24px 0;
}
.faq-item__question {
  font-size: 1.0625rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: ${text};
}
.faq-item__answer {
  font-size: 0.9375rem;
  color: ${textMuted};
  line-height: 1.7;
}

/* ===== CONTACT ===== */
.contact-section { background: ${primary}; color: white; }
.contact-section .section__title { color: white; }
.contact-section .section__subtitle { color: rgba(255,255,255,0.7); }
.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: start;
}
.contact-info__title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 24px;
}
.contact-info__item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
  font-size: 0.9375rem;
}
.contact-info__item-icon {
  width: 40px;
  height: 40px;
  background: rgba(255,255,255,0.1);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.contact-info__item-text { line-height: 1.5; }
.contact-form {
  background: white;
  padding: 32px;
  border-radius: 20px;
  color: ${text};
}
.contact-form__title {
  font-family: ${fontHeading};
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 24px;
}
.form-group { margin-bottom: 20px; }
.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 8px;
}
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 10px;
  font-size: 0.9375rem;
  font-family: inherit;
  background: ${surface};
  transition: border-color 0.2s, box-shadow 0.2s;
}
.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: ${primary};
  box-shadow: 0 0 0 3px rgba(${rgb.r},${rgb.g},${rgb.b},0.15);
}
.form-group textarea { resize: vertical; min-height: 100px; }

/* ===== CTA SECTION ===== */
.cta-section {
  background: linear-gradient(135deg, ${secondary} 0%, ${primary} 100%);
  color: white;
  text-align: center;
  padding: 80px 24px;
}
.cta-section__title {
  font-family: ${fontHeading};
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 700;
  margin-bottom: 16px;
}
.cta-section__subtitle {
  font-size: 1.125rem;
  opacity: 0.85;
  margin-bottom: 32px;
  max-width: 560px;
  margin-left: auto;
  margin-right: auto;
}

/* ===== FOOTER ===== */
.footer {
  background: ${surface};
  padding: 48px 0 32px;
  border-top: 1px solid rgba(0,0,0,0.06);
}
.footer__inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}
.footer__copy { font-size: 0.875rem; color: ${textMuted}; }
.footer__links { display: flex; gap: 24px; }
.footer__links a {
  font-size: 0.875rem;
  color: ${textMuted};
  transition: color 0.2s;
}
.footer__links a:hover { color: ${primary}; }

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  .section { padding: 60px 0; }
  .hero__inner { grid-template-columns: 1fr; }
  .hero__card { display: none; }
  .contact-grid { grid-template-columns: 1fr; }
  .header__nav { display: none; }
  .footer__inner { flex-direction: column; text-align: center; }
  .footer__links { justify-content: center; }
}

@media (max-width: 480px) {
  .container { padding: 0 16px; }
  .hero { padding: 60px 0 40px; }
  .btn { width: 100%; padding: 16px 24px; }
  .hero__actions { flex-direction: column; }
}
`;
}

export function getPreviewVersion(siteSpec: { designDirection?: DesignDirection }): string {
  const str = JSON.stringify(siteSpec);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}