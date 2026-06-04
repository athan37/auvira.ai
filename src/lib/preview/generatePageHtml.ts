import type { SiteSpec, DesignDirection } from '@/lib/agent/schemas';

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPreset(designDirection?: DesignDirection): {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  text: string;
  textMuted: string;
  heroBg: string;
  navBg: string;
  navText: string;
} {
  const tone = designDirection?.tone || 'professional';
  const colors = designDirection?.colors || [];

  const presets: Record<string, ReturnType<typeof getPreset>> = {
    'premium-professional': {
      primary: '#1e3a5f', secondary: '#2563eb', accent: '#f59e0b',
      surface: '#f8fafc', text: '#1e293b', textMuted: '#64748b',
      heroBg: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
      navBg: 'rgba(255,255,255,0.95)', navText: '#1e293b',
    },
    'warm-local': {
      primary: '#92400e', secondary: '#d97706', accent: '#10b981',
      surface: '#fef3c7', text: '#451a03', textMuted: '#78350f',
      heroBg: 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
      navBg: 'rgba(255,255,255,0.95)', navText: '#451a03',
    },
    'modern-minimal': {
      primary: '#000000', secondary: '#374151', accent: '#000000',
      surface: '#f9fafb', text: '#000000', textMuted: '#6b7280',
      heroBg: '#ffffff', navBg: 'transparent', navText: '#000000',
    },
    'bold-conversion': {
      primary: '#dc2626', secondary: '#ef4444', accent: '#fbbf24',
      surface: '#fef2f2', text: '#1f2937', textMuted: '#6b7280',
      heroBg: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
      navBg: 'rgba(255,255,255,0.95)', navText: '#1f2937',
    },
    'calm-healthcare': {
      primary: '#0f766e', secondary: '#14b8a6', accent: '#38bdf8',
      surface: '#f0fdfa', text: '#134e4a', textMuted: '#5eead4',
      heroBg: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
      navBg: 'rgba(255,255,255,0.95)', navText: '#134e4a',
    },
    'luxury-service': {
      primary: '#1e1b4b', secondary: '#4338ca', accent: '#fbbf24',
      surface: '#f5f3ff', text: '#1e1b4b', textMuted: '#6b7280',
      heroBg: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)',
      navBg: 'rgba(255,255,255,0.95)', navText: '#1e1b4b',
    },
    'general-service': {
      primary: '#1d4ed8', secondary: '#3b82f6', accent: '#10b981',
      surface: '#f0f9ff', text: '#0f172a', textMuted: '#475569',
      heroBg: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
      navBg: 'rgba(255,255,255,0.95)', navText: '#0f172a',
    },
    'professional': {
      primary: '#1e40af', secondary: '#3b82f6', accent: '#f59e0b',
      surface: '#eff6ff', text: '#1e293b', textMuted: '#64748b',
      heroBg: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
      navBg: 'rgba(255,255,255,0.95)', navText: '#1e293b',
    },
  };

  // Use colors from spec if available
  if (colors.length >= 3) {
    const p = presets['professional'];
    return {
      primary: colors[0],
      secondary: colors[1] || colors[0],
      accent: colors[2] || '#f59e0b',
      surface: p.surface,
      text: p.text,
      textMuted: p.textMuted,
      heroBg: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1] || colors[0]} 100%)`,
      navBg: 'rgba(255,255,255,0.95)',
      navText: p.text,
    };
  }

  return presets[tone] || presets['professional'];
}

function sectionIcons(type: string): string {
  const icons: Record<string, string> = {
    services: `<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`,
    about: `<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    testimonials: `<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>`,
    faq: `<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    contact: `<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`,
    booking: `<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
  };
  return icons[type] || icons.services;
}

export function generatePageHtml(siteSpec: SiteSpec, projectName: string, previewVersion: string): string {
  const p = getPreset(siteSpec.designDirection);

  const hero = siteSpec.sections.find((s: any) => s.type === 'hero');
  const services = siteSpec.sections.find((s: any) => s.type === 'services');
  const about = siteSpec.sections.find((s: any) => s.type === 'about');
  const testimonials = siteSpec.sections.find((s: any) => s.type === 'testimonials');
  const faq = siteSpec.sections.find((s: any) => s.type === 'faq');
  const contact = siteSpec.sections.find((s: any) => s.type === 'contact');
  const contactSectionIndex = siteSpec.sections.findIndex((s: any) => s.type === 'contact');
  const booking = siteSpec.sections.find((s: any) => s.type === 'booking');

  const primaryCTA = siteSpec.primaryCTA || 'Get Started';
  const secondaryCTA = siteSpec.secondaryCTA || 'Learn More';

  // Hero headline/subtitle
  const heroTitle = escapeHtml(hero?.title || siteSpec.siteTitle || projectName);
  const heroSubtitle = escapeHtml(hero?.body || siteSpec.tagline || '');
  const ctaSection = siteSpec.sections.find((s: any) => s.type === 'cta');
  const ctaText = ctaSection?.body || primaryCTA;

  // Phone/email from contact section
  const phone = contact?.items?.[0] || '';
  const email = contact?.items?.[1] || '';

  // Services items
  const servicesItems = (services?.items || []).slice(0, 6);
  const servicesGrid = servicesItems.length > 0 ? `
    <section class="section" id="services">
      <div class="container">
        <div class="section__header">
          <h2 class="section__title">${escapeHtml(services?.title || 'Our Services')}</h2>
          <p class="section__subtitle">${escapeHtml(services?.body || '')}</p>
        </div>
        <div class="service-grid">
          ${servicesItems.map((item: string) => `
            <div class="service-card">
              <div class="service-card__icon">${sectionIcons('services')}</div>
              <h3 class="service-card__title">${escapeHtml(item)}</h3>
              <p class="service-card__text">Professional service tailored to your needs.</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  ` : '';

  // About section
  const aboutItems = (about?.items || []).slice(0, 4);
  const aboutGrid = aboutItems.length > 0 ? `
    <section class="section section--alt" id="about">
      <div class="container">
        <div class="section__header">
          <h2 class="section__title">${escapeHtml(about?.title || 'Why Choose Us')}</h2>
          <p class="section__subtitle">${escapeHtml(about?.body || '')}</p>
        </div>
        <div class="about-grid">
          ${aboutItems.map((item: string) => `
            <div class="about-card about-card--filled">
              <h3 class="about-card__title">${escapeHtml(item)}</h3>
              <p class="about-card__text">Dedicated to excellence and customer satisfaction.</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  ` : '';

  // Testimonials
  const testimonialItems = (testimonials?.items || []).slice(0, 3);
  const testimonialsGrid = testimonialItems.length > 0 ? `
    <section class="section" id="testimonials">
      <div class="container">
        <div class="section__header">
          <h2 class="section__title">${escapeHtml(testimonials?.title || 'What Our Clients Say')}</h2>
          <p class="section__subtitle">${escapeHtml(testimonials?.body || '')}</p>
        </div>
        <div class="testimonial-grid">
          ${testimonialItems.map((item: string, i: number) => {
            const initials = item.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            return `
              <div class="testimonial-card">
                <div class="testimonial-card__stars">★★★★★</div>
                <p class="testimonial-card__quote">"${escapeHtml(item)}"</p>
                <div class="testimonial-card__author">
                  <div class="testimonial-card__avatar">${initials}</div>
                  <div>
                    <div class="testimonial-card__name">Satisfied Customer ${i + 1}</div>
                    <div class="testimonial-card__role">Verified Client</div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </section>
  ` : '';

  // FAQ
  const faqItems = (faq?.items || []).slice(0, 6);
  const faqSection = faqItems.length > 0 ? `
    <section class="section section--alt" id="faq">
      <div class="container">
        <div class="section__header">
          <h2 class="section__title">${escapeHtml(faq?.title || 'Frequently Asked Questions')}</h2>
          <p class="section__subtitle">${escapeHtml(faq?.body || '')}</p>
        </div>
        <div class="faq-list">
          ${faqItems.map((item: string) => `
            <div class="faq-item">
              <h3 class="faq-item__question">${escapeHtml(item)}</h3>
              <p class="faq-item__answer">Please contact us for more information about this topic.</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  ` : '';

  // Contact / CTA section
  const contactIdx = contactSectionIndex >= 0 ? contactSectionIndex : 0;
  const contactSection = `
    <section class="contact-section section" id="contact" data-site-section-type="contact" data-site-section-index="${contactIdx}">
      <div class="container">
        <div class="section__header">
          <h2 class="section__title" data-site-element-kind="heading" data-site-element-label="Section title" data-site-config-field-path="sections[${contactIdx}].title">${escapeHtml(contact?.title || 'Get in Touch')}</h2>
          <p class="section__subtitle" data-site-element-kind="body" data-site-element-label="Section intro" data-site-config-field-path="sections[${contactIdx}].body">${escapeHtml(contact?.body || 'We\'re here to help with all your needs.')}</p>
        </div>
        <div class="contact-grid">
          <div class="contact-info" data-site-element-kind="panel" data-site-element-label="Inner contact card" data-site-config-field-path="sections[${contactIdx}].presentation.cardClass">
            <h3 class="contact-info__title" data-site-element-kind="heading" data-site-element-label="Contact Information" data-site-config-field-path="sections[${contactIdx}].subtitle">${escapeHtml((contact as { subtitle?: string } | undefined)?.subtitle || 'Contact Information')}</h3>
            ${phone ? `
              <div class="contact-info__item" data-site-element-kind="contact_field" data-site-element-label="Phone in card" data-site-config-field-path="contact.phone">
                <div class="contact-info__item-icon">📞</div>
                <div class="contact-info__item-text">${escapeHtml(phone)}</div>
              </div>
            ` : ''}
            ${email ? `
              <div class="contact-info__item" data-site-element-kind="contact_field" data-site-element-label="Email in card" data-site-config-field-path="contact.email">
                <div class="contact-info__item-icon">✉️</div>
                <div class="contact-info__item-text">${escapeHtml(email)}</div>
              </div>
            ` : ''}
            <div style="margin-top: 24px;">
              <a href="#contact" class="btn btn--accent" style="display: inline-block; margin-bottom: 12px;" data-site-element-kind="button" data-site-element-label="Primary button" data-site-config-field-path="hero.primaryCta">${escapeHtml(ctaText)}</a>
            </div>
          </div>
          <div class="contact-form">
            <h3 class="contact-form__title">Send Us a Message</h3>
            <div class="form-group">
              <label>Your Name</label>
              <input type="text" placeholder="John Smith" />
            </div>
            <div class="form-group">
              <label>Phone Number</label>
              <input type="tel" placeholder="(555) 123-4567" />
            </div>
            <div class="form-group">
              <label>Email Address</label>
              <input type="email" placeholder="john@example.com" />
            </div>
            <div class="form-group">
              <label>Message</label>
              <textarea placeholder="How can we help you?"></textarea>
            </div>
            <button type="button" class="btn btn--primary" style="width: 100%;">Send Message</button>
          </div>
        </div>
      </div>
    </section>
  `;

  // Footer
  const footer = `
    <footer class="footer">
      <div class="container">
        <div class="footer__inner">
          <p class="footer__copy">© ${new Date().getFullYear()} ${escapeHtml(siteSpec.siteTitle || projectName)}</p>
          <div class="footer__links">
            <a href="#services">Services</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  `;

  // Main content sections (exclude hero, cta, contact from content flow)
  const contentSections = siteSpec.sections
    .filter((s: any) => !['hero', 'cta', 'contact'].includes(s.type))
    .map((section: any) => {
      if (section.type === 'services') return servicesGrid;
      if (section.type === 'about') return aboutGrid;
      if (section.type === 'testimonials') return testimonialsGrid;
      if (section.type === 'faq') return faqSection;
      return '';
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(siteSpec.siteTitle || projectName)}</title>
  <link rel="stylesheet" href="/api/projects/${'{{projectId}}'}/preview/styles.css?version=${previewVersion}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="container header__inner">
      <a href="#" class="header__logo">${escapeHtml(siteSpec.siteTitle || projectName)}</a>
      <nav class="header__nav">
        <a href="#services">Services</a>
        <a href="#about">About</a>
        <a href="#contact">Contact</a>
        <a href="#contact" class="header__cta">${escapeHtml(ctaText)}</a>
      </nav>
    </div>
  </header>

  <!-- Hero -->
  <section class="hero">
    <div class="container">
      <div class="hero__inner">
        <div class="hero__content">
          <p class="hero__eyebrow">Welcome</p>
          <h1 class="hero__title">${heroTitle}</h1>
          <p class="hero__subtitle">${heroSubtitle}</p>
          <div class="hero__actions">
            <a href="#contact" class="btn btn--primary">${escapeHtml(ctaText)}</a>
            <a href="#services" class="btn btn--secondary">${escapeHtml(secondaryCTA)}</a>
          </div>
        </div>
        <div class="hero__card">
          <p class="hero__card-label">Get Started</p>
          <h2 class="hero__card-title">Ready to work with us?</h2>
          <p class="hero__card-text">Get clear next steps and a professional experience from the first conversation.</p>
          <div style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 0.875rem;">
            <strong>Phone:</strong> ${escapeHtml(phone) || 'Call us today'}
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Content Sections -->
  ${contentSections}

  <!-- Contact -->
  ${contactSection}

  <!-- Footer -->
  ${footer}
</body>
</html>`;
}