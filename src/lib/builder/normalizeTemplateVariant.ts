import type { TemplateCategory, TemplateVariant } from './themePresets';
import { presets } from './themePresets';

/** Legacy LLM / plan variant names → theme preset variants. */
const LEGACY_VARIANT_MAP: Record<string, TemplateVariant> = {
  'legal-navy-gold': 'premium-professional',
  'healthcare-blue-emerald': 'healthcare-calm',
  'service-blue-cyan': 'local-service-pro',
  'restaurant-warm-red': 'restaurant-warm',
  'general-clean-blue': 'modern-clean',
};

const CATEGORY_ALIASES: Record<string, TemplateCategory> = {
  legal: 'legal',
  healthcare: 'healthcare',
  'home-services': 'home-services',
  restaurant: 'restaurant',
  professional: 'professional',
  'general-service': 'general-service',
  general: 'general-service',
};

export interface NormalizedTemplate {
  category: TemplateCategory;
  variant: TemplateVariant;
}

/**
 * Normalizes AI-suggested or user-selected template ids to theme preset enums.
 */
export function normalizeTemplateSelection(
  category: string,
  variant: string
): NormalizedTemplate {
  const normalizedVariant =
    (LEGACY_VARIANT_MAP[variant] as TemplateVariant | undefined) ||
    (variant in presets ? (variant as TemplateVariant) : null) ||
    'modern-clean';

  const preset = presets[normalizedVariant];
  const normalizedCategory =
    CATEGORY_ALIASES[category] || preset.category || 'general-service';

  return { category: normalizedCategory, variant: normalizedVariant };
}
