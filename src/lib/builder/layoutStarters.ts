import type { HeroStyle } from './templates';
import type { TemplateCategory, TemplateVariant } from './themePresets';

/** Owner-selectable layout + theme starter for scratch creation. */
export type LayoutStarterId =
  | 'professional-split'
  | 'centered-minimal'
  | 'phone-first-service'
  | 'menu-feature-restaurant'
  | 'appointment-hero-healthcare';

export interface LayoutStarter {
  id: LayoutStarterId;
  name: string;
  description: string;
  heroStyle: HeroStyle;
  category: TemplateCategory;
  variant: TemplateVariant;
}

const LAYOUT_STARTERS: LayoutStarter[] = [
  {
    id: 'professional-split',
    name: 'Professional Split',
    description: 'Two-column hero with headline and contact card — ideal for law firms and consultants.',
    heroStyle: 'split',
    category: 'legal',
    variant: 'premium-professional',
  },
  {
    id: 'centered-minimal',
    name: 'Centered Minimal',
    description: 'Clean centered hero focused on your headline and calls to action.',
    heroStyle: 'centered',
    category: 'general-service',
    variant: 'modern-clean',
  },
  {
    id: 'phone-first-service',
    name: 'Phone-First Service',
    description: 'Prominent phone number and quick contact — built for home service businesses.',
    heroStyle: 'phone-first',
    category: 'home-services',
    variant: 'local-service-pro',
  },
  {
    id: 'menu-feature-restaurant',
    name: 'Menu Feature',
    description: 'Warm hero highlighting featured offerings — great for restaurants and hospitality.',
    heroStyle: 'menu-feature',
    category: 'restaurant',
    variant: 'restaurant-warm',
  },
  {
    id: 'appointment-hero-healthcare',
    name: 'Appointment Hero',
    description: 'Calm, trust-focused hero with booking emphasis for clinics and healthcare.',
    heroStyle: 'appointment-hero',
    category: 'healthcare',
    variant: 'healthcare-calm',
  },
];

/** All layout starters for owner picker UI. */
export function getLayoutStarters(): LayoutStarter[] {
  return LAYOUT_STARTERS;
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
