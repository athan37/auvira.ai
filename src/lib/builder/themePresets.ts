// Hardcoded theme presets — all Tailwind classes are safe and predefined.
// LLM cannot generate arbitrary classes; it only selects enum values.

export type TemplateCategory =
  | 'legal'
  | 'home-services'
  | 'healthcare'
  | 'restaurant'
  | 'professional'
  | 'general-service';

export type TemplateVariant =
  | 'premium-professional'
  | 'local-service-pro'
  | 'healthcare-calm'
  | 'restaurant-warm'
  | 'modern-clean';

export type ThemePreset = {
  name: string;
  category: TemplateCategory;
  variant: TemplateVariant;

  // Page backgrounds
  pageBg: string;
  surfaceBg: string;
  mutedBg: string;

  // Nav
  navBg: string;
  navBorder: string;
  navText: string;

  // Hero
  heroBg: string;
  heroOverlay: string;
  heroText: string;
  heroMutedText: string;
  heroEyebrow: string;

  // Buttons
  primaryButton: string;
  secondaryButton: string;
  darkButton: string;

  // Cards
  card: string;
  cardHover: string;
  cardAccent: string;
  iconBadge: string;

  // Section text
  sectionEyebrow: string;
  sectionTitle: string;
  sectionBody: string;

  // Contact / footer
  contactBg: string;
  footerBg: string;
  footerAccent: string;

  // Fonts
  fontHeading: string;
  fontBody: string;

  // Spacing
  sectionSpacing: string;
};

export const presets: Record<TemplateVariant, ThemePreset> = {
  'premium-professional': {
    name: 'Premium Professional',
    category: 'legal',
    variant: 'premium-professional',

    pageBg: 'bg-[#F8F4EC]',
    surfaceBg: 'bg-[#FFFCF7]',
    mutedBg: 'bg-[#EFE7DA]',

    navBg: 'bg-[#FFFCF7]/95 backdrop-blur-md',
    navBorder: 'border-[#E5D8C2]',
    navText: 'text-[#0B1220]',

    heroBg: 'bg-[radial-gradient(circle_at_top_left,#1E293B_0%,#0B1220_45%,#050816_100%)]',
    heroOverlay: 'before:absolute before:inset-0 before:bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] before:bg-[size:48px_48px] before:opacity-20',
    heroText: 'text-white',
    heroMutedText: 'text-slate-300',
    heroEyebrow: 'text-amber-300',

    primaryButton: 'bg-[#C89B3C] text-[#0B1220] hover:bg-[#E0B85A] shadow-lg shadow-amber-900/20 font-semibold rounded-full px-8 py-4 text-base',
    secondaryButton: 'border-2 border-white/30 text-white hover:bg-white/10 font-semibold rounded-full px-8 py-4 text-base',
    darkButton: 'bg-[#0B1220] text-white hover:bg-[#111827] rounded-full px-8 py-4 text-base font-semibold',

    card: 'bg-[#FFFCF7] border border-[#E5D8C2] shadow-sm rounded-3xl p-8',
    cardHover: 'hover:-translate-y-1 hover:shadow-xl transition-all duration-300',
    cardAccent: 'border-t-4 border-t-[#C89B3C]',
    iconBadge: 'bg-[#C89B3C] text-[#0B1220] w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold',

    sectionEyebrow: 'text-[#9A6B16] uppercase tracking-[0.25em] text-xs font-bold',
    sectionTitle: 'font-serif text-4xl font-semibold tracking-tight text-[#0B1220] md:text-5xl',
    sectionBody: 'text-slate-600 text-lg leading-8',

    contactBg: 'bg-[#0B1220]',
    footerBg: 'bg-[#050816]',
    footerAccent: 'text-[#C89B3C]',

    fontHeading: 'font-serif',
    fontBody: 'font-sans',

    sectionSpacing: 'px-4 py-24 sm:px-6 lg:px-8',
  },

  'local-service-pro': {
    name: 'Local Service Pro',
    category: 'home-services',
    variant: 'local-service-pro',

    pageBg: 'bg-[#F0F9FF]',
    surfaceBg: 'bg-white',
    mutedBg: 'bg-[#E0F2FE]',

    navBg: 'bg-white/95 backdrop-blur-md',
    navBorder: 'border-sky-200',
    navText: 'text-[#0C4A6E]',

    heroBg: 'bg-[radial-gradient(circle_at_top_right,#0C4A6E_0%,#0369A1_50%,#075985_100%)]',
    heroOverlay: 'before:absolute before:inset-0 before:bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] before:bg-[size:48px_48px] before:opacity-25',
    heroText: 'text-white',
    heroMutedText: 'text-sky-200',
    heroEyebrow: 'text-sky-300',

    primaryButton: 'bg-[#0284C7] text-white hover:bg-[#0369A1] shadow-lg shadow-sky-900/20 font-bold rounded-full px-8 py-4 text-base',
    secondaryButton: 'border-2 border-white/30 text-white hover:bg-white/10 font-semibold rounded-full px-8 py-4 text-base',
    darkButton: 'bg-[#0C4A6E] text-white hover:bg-[#075985] rounded-full px-8 py-4 text-base font-semibold',

    card: 'bg-white border border-sky-200 shadow-sm rounded-3xl p-8',
    cardHover: 'hover:-translate-y-1 hover:shadow-xl transition-all duration-300',
    cardAccent: 'border-t-4 border-t-[#0284C7]',
    iconBadge: 'bg-[#0284C7] text-white w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold',

    sectionEyebrow: 'text-[#0284C7] uppercase tracking-[0.25em] text-xs font-bold',
    sectionTitle: 'font-bold text-4xl tracking-tight text-[#0C4A6E] md:text-5xl',
    sectionBody: 'text-slate-600 text-lg leading-8',

    contactBg: 'bg-[#0C4A6E]',
    footerBg: 'bg-[#075985]',
    footerAccent: 'text-sky-300',

    fontHeading: 'font-bold',
    fontBody: 'font-sans',

    sectionSpacing: 'px-4 py-20 sm:px-6 lg:px-8',
  },

  'healthcare-calm': {
    name: 'Healthcare Calm',
    category: 'healthcare',
    variant: 'healthcare-calm',

    pageBg: 'bg-[#F0FDFA]',
    surfaceBg: 'bg-white',
    mutedBg: 'bg-[#CCFBF1]',

    navBg: 'bg-white/95 backdrop-blur-md',
    navBorder: 'border-teal-200',
    navText: 'text-[#134E4A]',

    heroBg: 'bg-[radial-gradient(circle_at_top_right,#134E4A_0%,#0F3D3D_50%,#0A2E2E_100%)]',
    heroOverlay: 'before:absolute before:inset-0 before:bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] before:bg-[size:48px_48px] before:opacity-30',
    heroText: 'text-white',
    heroMutedText: 'text-teal-200',
    heroEyebrow: 'text-cyan-300',

    primaryButton: 'bg-[#0891B2] text-white hover:bg-[#0E7490] shadow-lg shadow-teal-900/20 font-semibold rounded-full px-8 py-4 text-base',
    secondaryButton: 'border-2 border-white/30 text-white hover:bg-white/10 font-semibold rounded-full px-8 py-4 text-base',
    darkButton: 'bg-[#134E4A] text-white hover:bg-[#0F3D3D] rounded-full px-8 py-4 text-base font-semibold',

    card: 'bg-white border border-teal-200 shadow-sm rounded-3xl p-8',
    cardHover: 'hover:-translate-y-1 hover:shadow-xl transition-all duration-300',
    cardAccent: 'border-t-4 border-t-[#0891B2]',
    iconBadge: 'bg-[#0891B2] text-white w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold',

    sectionEyebrow: 'text-[#0891B2] uppercase tracking-[0.25em] text-xs font-semibold',
    sectionTitle: 'font-semibold text-4xl tracking-tight text-[#134E4A] md:text-5xl',
    sectionBody: 'text-teal-700/80 text-lg leading-8',

    contactBg: 'bg-[#134E4A]',
    footerBg: 'bg-[#0A2E2E]',
    footerAccent: 'text-teal-300',

    fontHeading: 'font-semibold',
    fontBody: 'font-sans',

    sectionSpacing: 'px-4 py-20 sm:px-6 lg:px-8',
  },

  'restaurant-warm': {
    name: 'Restaurant Warm',
    category: 'restaurant',
    variant: 'restaurant-warm',

    pageBg: 'bg-[#FFFBEB]',
    surfaceBg: 'bg-white',
    mutedBg: 'bg-[#FEF3C7]',

    navBg: 'bg-white/95 backdrop-blur-md',
    navBorder: 'border-orange-200',
    navText: 'text-[#7C2D12]',

    heroBg: 'bg-[radial-gradient(circle_at_top_left,#9A3412_0%,#7C2D12_50%,#5C1D0E_100%)]',
    heroOverlay: 'before:absolute before:inset-0 before:bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] before:bg-[size:48px_48px] before:opacity-20',
    heroText: 'text-white',
    heroMutedText: 'text-orange-200',
    heroEyebrow: 'text-amber-300',

    primaryButton: 'bg-[#EA580C] text-white hover:bg-[#DC2626] shadow-lg shadow-orange-900/20 font-bold rounded-full px-8 py-4 text-base',
    secondaryButton: 'border-2 border-white/30 text-white hover:bg-white/10 font-semibold rounded-full px-8 py-4 text-base',
    darkButton: 'bg-[#7C2D12] text-white hover:bg-[#9A3412] rounded-full px-8 py-4 text-base font-semibold',

    card: 'bg-white border border-orange-200 shadow-sm rounded-3xl p-8',
    cardHover: 'hover:-translate-y-1 hover:shadow-xl transition-all duration-300',
    cardAccent: 'border-t-4 border-t-[#EA580C]',
    iconBadge: 'bg-[#EA580C] text-white w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold',

    sectionEyebrow: 'text-[#EA580C] uppercase tracking-[0.25em] text-xs font-bold',
    sectionTitle: 'font-bold text-4xl tracking-tight text-[#7C2D12] md:text-5xl',
    sectionBody: 'text-orange-800/80 text-lg leading-8',

    contactBg: 'bg-[#7C2D12]',
    footerBg: 'bg-[#5C1D0E]',
    footerAccent: 'text-orange-300',

    fontHeading: 'font-bold',
    fontBody: 'font-sans',

    sectionSpacing: 'px-4 py-20 sm:px-6 lg:px-8',
  },

  'modern-clean': {
    name: 'Modern Clean',
    category: 'general-service',
    variant: 'modern-clean',

    pageBg: 'bg-white',
    surfaceBg: 'bg-white',
    mutedBg: 'bg-slate-50',

    navBg: 'bg-white/95 backdrop-blur-md',
    navBorder: 'border-slate-200',
    navText: 'text-slate-900',

    heroBg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
    heroOverlay: 'before:absolute before:inset-0 before:bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] before:bg-[size:48px_48px] before:opacity-20',
    heroText: 'text-white',
    heroMutedText: 'text-slate-300',
    heroEyebrow: 'text-blue-400',

    primaryButton: 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20 font-semibold rounded-full px-8 py-4 text-base',
    secondaryButton: 'border-2 border-white/30 text-white hover:bg-white/10 font-semibold rounded-full px-8 py-4 text-base',
    darkButton: 'bg-slate-900 text-white hover:bg-slate-800 rounded-full px-8 py-4 text-base font-semibold',

    card: 'bg-white border border-slate-200 shadow-sm rounded-3xl p-8',
    cardHover: 'hover:-translate-y-1 hover:shadow-xl transition-all duration-300',
    cardAccent: 'border-t-4 border-t-blue-600',
    iconBadge: 'bg-blue-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold',

    sectionEyebrow: 'text-blue-600 uppercase tracking-[0.25em] text-xs font-bold',
    sectionTitle: 'font-bold text-4xl tracking-tight text-slate-900 md:text-5xl',
    sectionBody: 'text-slate-600 text-lg leading-8',

    contactBg: 'bg-slate-900',
    footerBg: 'bg-slate-950',
    footerAccent: 'text-blue-400',

    fontHeading: 'font-bold',
    fontBody: 'font-sans',

    sectionSpacing: 'px-4 py-20 sm:px-6 lg:px-8',
  },
};

export function getPreset(variant: TemplateVariant): ThemePreset {
  return presets[variant] ?? presets['modern-clean'];
}

// Microcopy per category
export const categoryMicrocopy: Record<TemplateCategory, {
  eyebrow: string;
  primaryCtaFallback: string;
  contactHeading: string;
}> = {
  legal: {
    eyebrow: 'Trusted Professional Guidance',
    primaryCtaFallback: 'Schedule a Consultation',
    contactHeading: 'Start a Conversation',
  },
  'home-services': {
    eyebrow: 'Trusted Local Service',
    primaryCtaFallback: 'Request a Quote',
    contactHeading: 'Request Service',
  },
  healthcare: {
    eyebrow: 'Patient-Centered Care',
    primaryCtaFallback: 'Book an Appointment',
    contactHeading: 'Schedule a Visit',
  },
  restaurant: {
    eyebrow: 'Fresh Local Dining',
    primaryCtaFallback: 'View Menu',
    contactHeading: 'Visit Us',
  },
  professional: {
    eyebrow: 'Professional Expertise',
    primaryCtaFallback: 'Get in Touch',
    contactHeading: 'Get Started',
  },
  'general-service': {
    eyebrow: 'Professional Local Service',
    primaryCtaFallback: 'Get Started',
    contactHeading: 'Get in Touch',
  },
};

export function getCategoryLabels(category: TemplateCategory) {
  return categoryMicrocopy[category] ?? categoryMicrocopy['general-service'];
}