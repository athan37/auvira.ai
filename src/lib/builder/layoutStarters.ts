import type { HeroStyle } from './templates';
import type { TemplateCategory, TemplateVariant, ThemePreset } from './themePresets';
import { getTemplateDisplayName } from './templateGallery';

/** Owner-selectable layout + theme starter for scratch creation. */
export type LayoutStarterId =
  | 'professional-split'
  | 'centered-minimal'
  | 'phone-first-service'
  | 'menu-feature-restaurant'
  | 'appointment-hero-healthcare';

export type LayoutHeroLayout = 'split-hero' | 'centered-hero' | 'editorial-hero' | 'conversion-hero';
export type LayoutSectionDensity = 'spacious' | 'balanced' | 'compact';
export type LayoutCardStyle = 'soft-shadow' | 'bordered' | 'glass' | 'premium-panel';
export type LayoutCtaPlacement = 'hero-heavy' | 'repeated' | 'footer-heavy';

export interface LayoutStrategy {
  heroLayout: LayoutHeroLayout;
  sectionDensity: LayoutSectionDensity;
  cardStyle: LayoutCardStyle;
  ctaPlacement: LayoutCtaPlacement;
}

export interface LayoutStarter {
  id: LayoutStarterId;
  name: string;
  description: string;
  useCaseLabel: string;
  heroStyle: HeroStyle;
  category: TemplateCategory;
  variant: TemplateVariant;
  layoutStrategy: LayoutStrategy;
}

const HERO_STYLE_TO_LAYOUT: Record<HeroStyle, LayoutHeroLayout> = {
  split: 'split-hero',
  centered: 'centered-hero',
  'phone-first': 'conversion-hero',
  'menu-feature': 'editorial-hero',
  'appointment-hero': 'split-hero',
};

const LAYOUT_STARTERS: LayoutStarter[] = [
  {
    id: 'professional-split',
    name: 'Professional Split',
    description: 'Two-column hero with headline and contact card — ideal for law firms and consultants.',
    useCaseLabel: 'Professional services',
    heroStyle: 'split',
    category: 'legal',
    variant: 'premium-professional',
    layoutStrategy: {
      heroLayout: 'split-hero',
      sectionDensity: 'spacious',
      cardStyle: 'premium-panel',
      ctaPlacement: 'repeated',
    },
  },
  {
    id: 'centered-minimal',
    name: 'Centered Minimal',
    description: 'Clean centered hero focused on your headline and calls to action.',
    useCaseLabel: 'General business',
    heroStyle: 'centered',
    category: 'general-service',
    variant: 'modern-clean',
    layoutStrategy: {
      heroLayout: 'centered-hero',
      sectionDensity: 'balanced',
      cardStyle: 'soft-shadow',
      ctaPlacement: 'hero-heavy',
    },
  },
  {
    id: 'phone-first-service',
    name: 'Phone-First Service',
    description: 'Prominent phone number and quick contact — built for home service businesses.',
    useCaseLabel: 'Home services',
    heroStyle: 'phone-first',
    category: 'home-services',
    variant: 'local-service-pro',
    layoutStrategy: {
      heroLayout: 'conversion-hero',
      sectionDensity: 'compact',
      cardStyle: 'bordered',
      ctaPlacement: 'hero-heavy',
    },
  },
  {
    id: 'menu-feature-restaurant',
    name: 'Menu Feature',
    description: 'Warm hero highlighting featured offerings — great for restaurants and hospitality.',
    useCaseLabel: 'Restaurant & hospitality',
    heroStyle: 'menu-feature',
    category: 'restaurant',
    variant: 'restaurant-warm',
    layoutStrategy: {
      heroLayout: 'editorial-hero',
      sectionDensity: 'balanced',
      cardStyle: 'soft-shadow',
      ctaPlacement: 'repeated',
    },
  },
  {
    id: 'appointment-hero-healthcare',
    name: 'Appointment Hero',
    description: 'Calm, trust-focused hero with booking emphasis for clinics and healthcare.',
    useCaseLabel: 'Healthcare',
    heroStyle: 'appointment-hero',
    category: 'healthcare',
    variant: 'healthcare-calm',
    layoutStrategy: {
      heroLayout: 'split-hero',
      sectionDensity: 'spacious',
      cardStyle: 'glass',
      ctaPlacement: 'hero-heavy',
    },
  },
];

const SECTION_DENSITY_SPACING: Record<LayoutSectionDensity, string> = {
  spacious: 'px-4 py-24 sm:px-6 lg:px-8',
  balanced: 'px-4 py-20 sm:px-6 lg:px-8',
  compact: 'px-4 py-16 sm:px-6 lg:px-8',
};

const CARD_STYLE_CLASSES: Record<LayoutCardStyle, { card: string; cardHover: string }> = {
  'soft-shadow': {
    card: 'bg-white border border-slate-200 shadow-sm',
    cardHover: 'hover:-translate-y-1 hover:shadow-xl',
  },
  bordered: {
    card: 'bg-white border-2 border-slate-200',
    cardHover: 'hover:border-slate-300',
  },
  glass: {
    card: 'bg-white/80 border border-white/40 backdrop-blur-sm shadow-md',
    cardHover: 'hover:bg-white/90',
  },
  'premium-panel': {
    card: 'bg-white/95 border border-slate-200 shadow-xl shadow-slate-900/5',
    cardHover: 'hover:-translate-y-1 hover:shadow-2xl',
  },
};

/** All layout starters for owner picker UI. */
export function getLayoutStarters(): LayoutStarter[] {
  return LAYOUT_STARTERS;
}

/** Starters grouped by use-case label for gallery UI. */
export function getLayoutStartersByCategory(): Record<string, LayoutStarter[]> {
  const grouped: Record<string, LayoutStarter[]> = {};
  for (const starter of LAYOUT_STARTERS) {
    if (!grouped[starter.useCaseLabel]) grouped[starter.useCaseLabel] = [];
    grouped[starter.useCaseLabel].push(starter);
  }
  return grouped;
}

/** Resolve a layout starter by id; returns undefined when id is missing or unknown. */
export function getLayoutStarter(id: string | undefined | null): LayoutStarter | undefined {
  if (!id) return undefined;
  return LAYOUT_STARTERS.find((starter) => starter.id === id);
}

/** Default starter when owner does not pick one. */
export function getDefaultLayoutStarter(): LayoutStarter {
  return LAYOUT_STARTERS.find((s) => s.id === 'centered-minimal') ?? LAYOUT_STARTERS[0];
}

/** Human-readable layout starter name. */
export function getLayoutStarterDisplayName(id: string): string {
  return getLayoutStarter(id)?.name ?? id.replace(/-/g, ' ');
}

/** Theme display name paired with layout starter for gallery subtitles. */
export function getLayoutStarterThemeLabel(starter: LayoutStarter): string {
  return getTemplateDisplayName(starter.variant);
}

/** Recommend a starter from industry keywords (deterministic, no LLM). */
export function recommendLayoutStarterForIndustry(industry: string): LayoutStarter {
  const text = industry.toLowerCase();

  if (/law|attorney|legal|paralegal|litigation/.test(text)) {
    return getLayoutStarter('professional-split')!;
  }
  if (/restaurant|food|cafe|café|bakery|hospitality|bar\b/.test(text)) {
    return getLayoutStarter('menu-feature-restaurant')!;
  }
  if (/health|medical|dental|clinic|doctor|therapy|care/.test(text)) {
    return getLayoutStarter('appointment-hero-healthcare')!;
  }
  if (/hvac|plumb|roof|electric|contractor|clean|landscap|garage|service/.test(text)) {
    return getLayoutStarter('phone-first-service')!;
  }

  return getDefaultLayoutStarter();
}

/** Map hero style enum to design-brief heroLayout value. */
export function heroLayoutForStyle(heroStyle: HeroStyle): LayoutHeroLayout {
  return HERO_STYLE_TO_LAYOUT[heroStyle];
}

/** Apply layout starter strategy tokens onto a theme preset for page generation. */
export function applyLayoutStrategyToPreset(
  preset: ThemePreset & { heroStyle?: HeroStyle },
  layoutStarter?: LayoutStarter
): ThemePreset & { heroStyle: HeroStyle } {
  if (!layoutStarter) {
    return { ...preset, heroStyle: preset.heroStyle ?? 'split' };
  }

  const { layoutStrategy } = layoutStarter;
  const cardTokens = CARD_STYLE_CLASSES[layoutStrategy.cardStyle];

  return {
    ...preset,
    heroStyle: layoutStarter.heroStyle,
    sectionSpacing: SECTION_DENSITY_SPACING[layoutStrategy.sectionDensity],
    card: cardTokens.card,
    cardHover: cardTokens.cardHover,
  };
}
