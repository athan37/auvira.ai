/**
 * Build section background gradients as Tailwind arbitrary values (RGB hex stops).
 * Any named color pair resolves to a predictable linear-gradient without safelist gaps.
 */

import {
  TAILWIND_BACKGROUND_HEX,
  type ShadedBackgroundFamily,
} from './tailwindBackgroundPalette';

export const DEFAULT_GRADIENT_ANGLE_DEG = 135;

type GradientStopRole = 'light' | 'mid' | 'dark';
type GradientEndpoint = 'start' | 'end';

function normalizeFamily(colorName: string): string {
  const normalized = colorName.trim().toLowerCase();
  return normalized === 'grey' ? 'gray' : normalized;
}

function isFlatColor(family: string): boolean {
  return family === 'black' || family === 'white';
}

function shadedFamilyHex(family: string, shade: 400 | 500 | 600 | 900): string {
  const scale = TAILWIND_BACKGROUND_HEX[family as ShadedBackgroundFamily];
  if (!scale || typeof scale === 'string') {
    return TAILWIND_BACKGROUND_HEX.gray[500];
  }
  return scale[shade];
}

/** Map a color word to an RGB hex stop tuned for gradient readability. */
export function hexForGradientStop(colorName: string, role: GradientStopRole): string {
  const family = normalizeFamily(colorName);
  if (family === 'black') {
    return role === 'light' ? '#374151' : role === 'mid' ? '#111827' : '#000000';
  }
  if (family === 'white') {
    return role === 'light' ? '#ffffff' : role === 'mid' ? '#e5e7eb' : '#9ca3af';
  }
  const shade = role === 'light' ? 400 : role === 'mid' ? 600 : 900;
  return shadedFamilyHex(family, shade);
}

function hexForGradientEndpoint(colorName: string, endpoint: GradientEndpoint): string {
  const family = normalizeFamily(colorName);
  if (family === 'black') return '#000000';
  if (family === 'white') return '#ffffff';
  return shadedFamilyHex(family, endpoint === 'start' ? 600 : 500);
}

/** Wrap a CSS linear-gradient as a Tailwind arbitrary background class. */
export function toArbitraryGradientClass(linearGradientCss: string): string {
  const normalized = linearGradientCss.trim().replace(/ /g, '_');
  return `bg-[${normalized}]`;
}

/** Build `bg-[linear-gradient(...)]` from hex stops. */
export function buildLinearGradientBackgroundClass(
  stops: Array<{ hex: string; at: string }>,
  angleDeg = DEFAULT_GRADIENT_ANGLE_DEG
): string {
  const body = stops.map((stop) => `${stop.hex}_${stop.at}`).join(',');
  return `bg-[linear-gradient(${angleDeg}deg,${body})]`;
}

/** Black ↔ white gradient with a neutral mid stop. */
export function buildBlackWhiteGradientBackgroundClass(): string {
  return buildLinearGradientBackgroundClass([
    { hex: '#ffffff', at: '0%' },
    { hex: TAILWIND_BACKGROUND_HEX.gray[500], at: '50%' },
    { hex: '#000000', at: '100%' },
  ]);
}

/** Single-hue tonal gradient (light → mid → dark). */
export function buildTonalGradientBackgroundClass(colorName: string): string {
  return buildLinearGradientBackgroundClass([
    { hex: hexForGradientStop(colorName, 'light'), at: '0%' },
    { hex: hexForGradientStop(colorName, 'mid'), at: '50%' },
    { hex: hexForGradientStop(colorName, 'dark'), at: '100%' },
  ]);
}

/** Two-hue gradient from owner phrasing (e.g. blue → yellow). */
export function buildTwoColorGradientBackgroundClass(
  fromColor: string,
  toColor: string
): string {
  const from = normalizeFamily(fromColor);
  const to = normalizeFamily(toColor);
  if (from === to) {
    return buildTonalGradientBackgroundClass(from);
  }
  if (isFlatColor(from) && isFlatColor(to)) {
    return buildBlackWhiteGradientBackgroundClass();
  }
  return buildLinearGradientBackgroundClass([
    { hex: hexForGradientEndpoint(fromColor, 'start'), at: '0%' },
    { hex: hexForGradientEndpoint(toColor, 'end'), at: '100%' },
  ]);
}

/** Default brand-style gradient when no hue is specified. */
export function buildDefaultGradientBackgroundClass(): string {
  return buildLinearGradientBackgroundClass([
    { hex: TAILWIND_BACKGROUND_HEX.blue[600], at: '0%' },
    { hex: TAILWIND_BACKGROUND_HEX.indigo[600], at: '50%' },
    { hex: TAILWIND_BACKGROUND_HEX.purple[600], at: '100%' },
  ]);
}
