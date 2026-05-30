/**
 * Per-section presentation overrides stored in siteConfig.sections[].presentation.
 * Keep resolver logic in sync with sectionPresentationRuntime.ts (inlined in generated page.tsx).
 */

export type SiteSectionPresentation = {
  backgroundClass?: string;
  cardClass?: string;
  eyebrowClass?: string;
  titleClass?: string;
  bodyClass?: string;
};

export type SectionLike = {
  type: string;
  presentation?: SiteSectionPresentation;
};

export type PresetLike = Record<string, string>;

/** Preset key used when no presentation.backgroundClass is set. */
export function defaultSectionBackgroundKey(type: string): string {
  switch (type) {
    case 'about':
    case 'faq':
    case 'gallery':
      return 'mutedBg';
    case 'contact':
      return 'contactBg';
    default:
      return 'surfaceBg';
  }
}

function pickPresentation(
  section: SectionLike,
  field: keyof SiteSectionPresentation,
  presetKey: string,
  preset: PresetLike,
  fallback: string
): string {
  const override = section.presentation?.[field];
  if (typeof override === 'string' && override.trim()) {
    return override.trim();
  }
  return preset[presetKey] ?? fallback;
}

export function resolveSectionBackground(section: SectionLike, preset: PresetLike): string {
  const key = defaultSectionBackgroundKey(section.type);
  return pickPresentation(section, 'backgroundClass', key, preset, preset.surfaceBg ?? 'bg-white');
}

export function resolveSectionCardClass(section: SectionLike, preset: PresetLike): string {
  return pickPresentation(section, 'cardClass', 'card', preset, preset.card ?? 'bg-white border');
}

export function resolveSectionEyebrowClass(section: SectionLike, preset: PresetLike): string {
  return pickPresentation(
    section,
    'eyebrowClass',
    'sectionEyebrow',
    preset,
    preset.sectionEyebrow ?? 'text-slate-600'
  );
}

export function resolveSectionTitleClass(section: SectionLike, preset: PresetLike): string {
  return pickPresentation(
    section,
    'titleClass',
    'sectionTitle',
    preset,
    preset.sectionTitle ?? 'text-slate-950'
  );
}

export function resolveSectionBodyClass(section: SectionLike, preset: PresetLike): string {
  return pickPresentation(
    section,
    'bodyClass',
    'sectionBody',
    preset,
    preset.sectionBody ?? 'text-slate-600'
  );
}

import {
  extractBackgroundColorFromMessage,
  extractColorsFromMessage,
  isGradientBackgroundRequest,
  stripQuotedSpans,
} from '@/lib/project-workspace/website-edit-agent/preset/presetUtils';
import { resolveTailwindBackgroundClass } from './tailwindBackgroundResolver';

/** Tailwind background utilities without shade suffixes (not bg-black-600). */
export const FLAT_BACKGROUND_COLOR_NAMES = ['black', 'white'] as const;

export type FlatBackgroundColorName = (typeof FLAT_BACKGROUND_COLOR_NAMES)[number];

export function isFlatBackgroundColorName(colorName: string): boolean {
  return (FLAT_BACKGROUND_COLOR_NAMES as readonly string[]).includes(
    colorName.trim().toLowerCase()
  );
}

/** Map a color name from owner chat to a valid Tailwind background utility class. */
export function colorNameToBackgroundClass(
  color: string,
  ownerMessage?: string
): string {
  return resolveTailwindBackgroundClass(color, ownerMessage);
}

/**
 * Resolve a gradient background class from owner phrasing.
 * Uses an explicit hue when present; otherwise a multi-color default gradient.
 */
export function resolveGradientBackgroundClass(ownerMessage?: string): string {
  const colors = extractColorsFromMessage(stripQuotedSpans(ownerMessage ?? ''));
  const family = colors[0] ?? null;
  if (family) {
    const normalized = family === 'grey' ? 'gray' : family;
    return `bg-gradient-to-br from-${normalized}-400 via-${normalized}-600 to-${normalized}-900`;
  }
  return 'bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600';
}

/**
 * Resolve section backgroundClass from owner message (solid or gradient).
 */
export function extractSectionBackgroundClassFromMessage(message: string): string | null {
  if (isGradientBackgroundRequest(message)) {
    return resolveGradientBackgroundClass(message);
  }
  const color = extractBackgroundColorFromMessage(message);
  if (!color) return null;
  return colorNameToBackgroundClass(color, message);
}

/** Map a color name to Tailwind classes for cards in a section. */
export function colorNameToCardClass(color: string): string {
  const normalized = color.trim().toLowerCase();
  if (normalized.includes('border-') || normalized.includes('bg-')) return normalized;
  return `border-${normalized}-300 bg-${normalized}-50`;
}
