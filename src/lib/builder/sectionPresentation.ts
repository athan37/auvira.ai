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
  parseColorSwap,
  stripQuotedSpans,
} from '@/lib/project-workspace/edit-shared/preset/presetUtils';
import {
  resolveTailwindBackgroundClass,
  normalizeTailwindBackgroundClass,
  resolveTailwindTextClass,
} from './tailwindBackgroundResolver';
import { isTextColorEditRequest } from '@/lib/project-workspace/verifyPreviewHints';
import { isEmitableTailwindBackgroundClass } from './tailwindPresentationSupport';
import {
  buildBlackWhiteGradientBackgroundClass,
  buildDefaultGradientBackgroundClass,
  buildTonalGradientBackgroundClass,
  buildTwoColorGradientBackgroundClass,
} from './gradientBuilder';

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

/** Flat black/white tokens in gradient requests (includes common "back" typo for black). */
function flatGradientColorsFromMessage(message: string): FlatBackgroundColorName[] {
  const lower = stripQuotedSpans(message).toLowerCase();
  const found: FlatBackgroundColorName[] = [];
  if (/\bblack\b/.test(lower) || /\bback\b/.test(lower)) found.push('black');
  if (/\bwhite\b/.test(lower)) found.push('white');
  return found;
}

/** Valid Tailwind gradient for black ↔ white (RGB stops, no invalid shade tokens). */
export function blackWhiteGradientBackgroundClass(): string {
  return buildBlackWhiteGradientBackgroundClass();
}

/** Two-hue gradient from owner phrasing (e.g. blue → yellow). */
export function twoColorGradientBackgroundClass(fromColor: string, toColor: string): string {
  return buildTwoColorGradientBackgroundClass(fromColor, toColor);
}

/**
 * Resolve a gradient background class from owner phrasing.
 * Uses explicit from→to hues when present; single hue uses a tonal gradient; black/white use flat stops.
 */
export function resolveGradientBackgroundClass(ownerMessage?: string): string {
  const message = ownerMessage ?? '';
  const flatColors = flatGradientColorsFromMessage(message);
  if (flatColors.length >= 2) {
    return blackWhiteGradientBackgroundClass();
  }

  const swap = parseColorSwap(message);
  if (swap && swap.fromColor !== swap.toColor) {
    if (
      isFlatBackgroundColorName(swap.fromColor) &&
      isFlatBackgroundColorName(swap.toColor)
    ) {
      return blackWhiteGradientBackgroundClass();
    }
    return twoColorGradientBackgroundClass(swap.fromColor, swap.toColor);
  }

  if (flatColors.length === 1) {
    return flatColors[0] === 'white'
      ? buildTonalGradientBackgroundClass('white')
      : buildTonalGradientBackgroundClass('black');
  }

  const colors = extractColorsFromMessage(stripQuotedSpans(message));
  const family = colors[0] ?? null;
  if (family) {
    const normalized = family === 'grey' ? 'gray' : family;
    if (isFlatBackgroundColorName(normalized)) {
      return buildTonalGradientBackgroundClass(normalized);
    }
    return buildTonalGradientBackgroundClass(normalized);
  }
  return buildDefaultGradientBackgroundClass();
}

/**
 * Normalize gradient background utilities; repairs invalid flat-color shades (e.g. from-white-400).
 */
export function normalizeGradientBackgroundClass(
  className: string,
  ownerMessage?: string
): string {
  const trimmed = className.trim();
  if (!trimmed.includes('gradient')) {
    return normalizeTailwindBackgroundClass(trimmed, ownerMessage);
  }
  if (isEmitableTailwindBackgroundClass(trimmed)) {
    return trimmed;
  }
  if (/\bfrom-(?:black|white)-\d{2,3}\b/i.test(trimmed)) {
    const fromMessage = ownerMessage ? resolveGradientBackgroundClass(ownerMessage) : '';
    if (fromMessage && isEmitableTailwindBackgroundClass(fromMessage)) {
      return fromMessage;
    }
    if (/\bwhite\b/i.test(trimmed) && /\bblack\b/i.test(trimmed)) {
      return blackWhiteGradientBackgroundClass();
    }
    if (/\bwhite\b/i.test(trimmed)) {
      return buildTonalGradientBackgroundClass('white');
    }
    return buildTonalGradientBackgroundClass('black');
  }
  const fromMessage = ownerMessage ? resolveGradientBackgroundClass(ownerMessage) : '';
  if (fromMessage && isEmitableTailwindBackgroundClass(fromMessage)) {
    return fromMessage;
  }
  return trimmed;
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

/** Owner-facing summary for section background edits (human-readable for gradients). */
export function formatSectionBackgroundChangeSummary(
  sectionTitle: string,
  backgroundClass: string,
  ownerMessage?: string
): string {
  if (
    backgroundClass.includes('gradient') ||
    (ownerMessage ? isGradientBackgroundRequest(ownerMessage) : false)
  ) {
    return `We updated the background of "${sectionTitle}" to a color gradient.`;
  }
  return `Changed background of "${sectionTitle}" to ${backgroundClass}.`;
}

const BACKGROUND_COLOR_META = new Set([
  'color',
  'colour',
  'gradient',
  'gradients',
  'background',
  'bg',
]);

/**
 * Resolve the background class for a section edit — owner message wins over planner/LLM args.
 */
export function resolveSectionBackgroundClassForEdit(
  ownerMessage: string,
  overrides?: {
    backgroundClass?: string | null;
    backgroundColor?: string | null;
    color?: string | null;
  }
): string | null {
  const fromMessage = extractSectionBackgroundClassFromMessage(ownerMessage);
  if (fromMessage) return fromMessage;

  const explicitClass = overrides?.backgroundClass?.trim();
  if (explicitClass) {
    const normalized = explicitClass.includes('gradient')
      ? normalizeGradientBackgroundClass(explicitClass, ownerMessage)
      : normalizeTailwindBackgroundClass(explicitClass, ownerMessage);
    return normalized || null;
  }

  const colorWord = (overrides?.backgroundColor ?? overrides?.color)?.trim().toLowerCase();
  if (colorWord && !BACKGROUND_COLOR_META.has(colorWord)) {
    return colorNameToBackgroundClass(colorWord, ownerMessage);
  }

  return null;
}

export { isGradientBackgroundRequest } from '@/lib/project-workspace/edit-shared/preset/presetUtils';

/** Map a color name to Tailwind classes for cards in a section. */
export function colorNameToCardClass(color: string): string {
  const normalized = color.trim().toLowerCase();
  if (normalized.includes('border-') || normalized.includes('bg-')) return normalized;
  return `border-${normalized}-300 bg-${normalized}-50`;
}

/** Resolve inner card class from owner message (solid colors on presentation.cardClass). */
export function resolveSectionCardClassForEdit(
  ownerMessage: string,
  overrides?: {
    cardClass?: string | null;
    backgroundColor?: string | null;
    color?: string | null;
  }
): string | null {
  const color = extractBackgroundColorFromMessage(ownerMessage);
  if (color) return colorNameToCardClass(color);

  const explicitClass = overrides?.cardClass?.trim();
  if (explicitClass) return explicitClass;

  const colorWord = (overrides?.backgroundColor ?? overrides?.color)?.trim().toLowerCase();
  if (colorWord && !BACKGROUND_COLOR_META.has(colorWord)) {
    return colorNameToCardClass(colorWord);
  }

  return null;
}

/** Map a color name from owner chat to a Tailwind text utility (e.g. "green" -> text-green-600). */
export function colorNameToTextClass(color: string, ownerMessage?: string): string {
  return resolveTailwindTextClass(color, ownerMessage);
}

/** Resolve section title/body text class from owner message when they ask for heading/title color. */
export function extractSectionTextClassFromMessage(message: string): string | null {
  if (!isTextColorEditRequest(message)) return null;
  const color = extractBackgroundColorFromMessage(message);
  if (!color) return null;
  return colorNameToTextClass(color, message);
}

/** Resolve text class for a section edit — owner message wins over planner/LLM args. */
export function resolveSectionTextClassForEdit(
  ownerMessage: string,
  overrides?: {
    textClass?: string | null;
    color?: string | null;
  }
): string | null {
  const fromMessage = extractSectionTextClassFromMessage(ownerMessage);
  if (fromMessage) return fromMessage;

  const explicitClass = overrides?.textClass?.trim();
  if (explicitClass) {
    if (explicitClass.startsWith('text-')) return explicitClass;
    return resolveTailwindTextClass(explicitClass, ownerMessage) || null;
  }

  const colorWord = overrides?.color?.trim().toLowerCase();
  if (colorWord && !BACKGROUND_COLOR_META.has(colorWord)) {
    return colorNameToTextClass(colorWord, ownerMessage) || null;
  }

  return null;
}

/** Owner-facing summary for section heading/body text color edits. */
export function formatSectionTextColorChangeSummary(
  sectionTitle: string,
  textClass: string,
  presentationField: 'titleClass' | 'bodyClass' | 'eyebrowClass' = 'titleClass'
): string {
  const label =
    presentationField === 'bodyClass'
      ? 'body text'
      : presentationField === 'eyebrowClass'
        ? 'eyebrow'
        : 'heading';
  return `Changed ${label} color of "${sectionTitle}" to ${textClass}.`;
}
