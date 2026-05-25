import type { TemplateCategory, TemplateVariant } from './themePresets';
import { presets } from './themePresets';

export interface TemplateGalleryEntry {
  category: TemplateCategory;
  variant: TemplateVariant;
  name: string;
  description: string;
  accentColor: string;
}

const GALLERY_DESCRIPTIONS: Record<TemplateVariant, string> = {
  'premium-professional': 'Refined layout for law firms and professional services.',
  'local-service-pro': 'Bold, trustworthy look for home service businesses.',
  'healthcare-calm': 'Calm, accessible design for clinics and healthcare.',
  'restaurant-warm': 'Warm, inviting style for restaurants and hospitality.',
  'modern-clean': 'Clean, versatile layout for any local business.',
};

const ACCENT_COLORS: Record<TemplateVariant, string> = {
  'premium-professional': '#C89B3C',
  'local-service-pro': '#0284C7',
  'healthcare-calm': '#0891B2',
  'restaurant-warm': '#DC2626',
  'modern-clean': '#2563EB',
};

/** Code-defined template gallery entries for owner picker UI. */
export function getTemplateGallery(): TemplateGalleryEntry[] {
  return (Object.keys(presets) as TemplateVariant[]).map((variant) => {
    const preset = presets[variant];
    return {
      category: preset.category,
      variant,
      name: preset.name,
      description: GALLERY_DESCRIPTIONS[variant],
      accentColor: ACCENT_COLORS[variant],
    };
  });
}

/** Human-readable theme name for a variant id. */
export function getTemplateDisplayName(variant: string): string {
  const entry = getTemplateGallery().find((t) => t.variant === variant);
  return entry?.name ?? variant.replace(/-/g, ' ');
}

/** Templates grouped by industry category for scratch / clone pickers. */
export function getTemplatesByCategory(): Record<TemplateCategory, TemplateGalleryEntry[]> {
  const grouped = {} as Record<TemplateCategory, TemplateGalleryEntry[]>;
  for (const entry of getTemplateGallery()) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(entry);
  }
  return grouped;
}
