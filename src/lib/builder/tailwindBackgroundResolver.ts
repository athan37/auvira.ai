/**
 * Resolve owner color words to valid Tailwind background utilities using the
 * default palette (closest match + shade intent from message).
 */

import { isEmitableTailwindBackgroundClass } from './tailwindPresentationSupport';
import { BACKGROUND_STYLING_META_WORDS } from '@/lib/project-workspace/website-edit-agent/preset/presetUtils';
import {
  BACKGROUND_SHADES,
  buildBackgroundPalette,
  SHADED_BACKGROUND_FAMILIES,
  type BackgroundPaletteEntry,
  type BackgroundShade,
  type ShadedBackgroundFamily,
} from './tailwindBackgroundPalette';

const FLAT_COLOR_NAMES = new Set(['black', 'white']);

/** Common owner color words mapped to palette family + optional fixed shade. */
const COLOR_WORD_ALIASES: Record<
  string,
  { family: ShadedBackgroundFamily | 'black' | 'white'; shade?: BackgroundShade }
> = {
  navy: { family: 'blue', shade: 900 },
  maroon: { family: 'red', shade: 800 },
  crimson: { family: 'red', shade: 700 },
  scarlet: { family: 'red', shade: 600 },
  brown: { family: 'orange', shade: 800 },
  tan: { family: 'orange', shade: 200 },
  beige: { family: 'yellow', shade: 100 },
  cream: { family: 'yellow', shade: 50 },
  ivory: { family: 'yellow', shade: 50 },
  gold: { family: 'yellow', shade: 500 },
  silver: { family: 'gray', shade: 400 },
  charcoal: { family: 'gray', shade: 800 },
  slate: { family: 'gray', shade: 600 },
  grey: { family: 'gray' },
  lime: { family: 'green', shade: 400 },
  olive: { family: 'green', shade: 700 },
  magenta: { family: 'purple', shade: 600 },
  violet: { family: 'purple', shade: 600 },
  lavender: { family: 'purple', shade: 200 },
  turquoise: { family: 'teal', shade: 500 },
  aqua: { family: 'cyan', shade: 400 },
  sky: { family: 'blue', shade: 400 },
  coral: { family: 'orange', shade: 400 },
  salmon: { family: 'orange', shade: 300 },
  peach: { family: 'orange', shade: 200 },
  mint: { family: 'green', shade: 200 },
  rose: { family: 'pink', shade: 400 },
  burgundy: { family: 'red', shade: 900 },
  wine: { family: 'red', shade: 900 },
};

let cachedPalette: BackgroundPaletteEntry[] | null = null;

function palette(): BackgroundPaletteEntry[] {
  if (!cachedPalette) cachedPalette = buildBackgroundPalette();
  return cachedPalette;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized.length >= 6
        ? normalized.slice(0, 6)
        : null;
  if (!full) return null;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return null;
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbDistance(a: string, b: string): number {
  const rgbA = hexToRgb(a);
  const rgbB = hexToRgb(b);
  if (!rgbA || !rgbB) return Number.POSITIVE_INFINITY;
  const dr = rgbA.r - rgbB.r;
  const dg = rgbA.g - rgbB.g;
  const db = rgbA.b - rgbB.b;
  return dr * dr + dg * dg + db * db;
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[rows - 1][cols - 1];
}

export type ShadeIntent = 'light' | 'medium' | 'dark';

/** Infer light / medium / dark shade band from owner message. */
export function shadeIntentFromMessage(ownerMessage?: string): ShadeIntent {
  const msg = (ownerMessage ?? '').toLowerCase();
  if (/\b(light|pale|soft|pastel|faint)\b/.test(msg)) return 'light';
  if (/\b(dark|deep|rich|bold|strong)\b/.test(msg)) return 'dark';
  return 'medium';
}

function shadeFromIntent(intent: ShadeIntent): BackgroundShade {
  switch (intent) {
    case 'light':
      return 200;
    case 'dark':
      return 800;
    default:
      return 600;
  }
}

function shadesForIntent(intent: ShadeIntent): BackgroundShade[] {
  switch (intent) {
    case 'light':
      return [50, 100, 200, 300];
    case 'dark':
      return [700, 800, 900];
    default:
      return [500, 600];
  }
}

function isShadedFamily(family: string): family is ShadedBackgroundFamily {
  return (SHADED_BACKGROUND_FAMILIES as readonly string[]).includes(family);
}

function classForFamilyShade(
  family: ShadedBackgroundFamily | 'black' | 'white',
  shade?: BackgroundShade,
  ownerMessage?: string
): string {
  if (family === 'black') {
    return shadeIntentFromMessage(ownerMessage) === 'light' ? 'bg-gray-800' : 'bg-black';
  }
  if (family === 'white') {
    return shadeIntentFromMessage(ownerMessage) === 'light' ? 'bg-gray-100' : 'bg-white';
  }
  const resolvedShade = shade ?? shadeFromIntent(shadeIntentFromMessage(ownerMessage));
  return `bg-${family}-${resolvedShade}`;
}

function closestFamilyByName(name: string): ShadedBackgroundFamily {
  let best: ShadedBackgroundFamily = 'gray';
  let bestScore = Number.POSITIVE_INFINITY;
  for (const family of SHADED_BACKGROUND_FAMILIES) {
    const score = levenshtein(name, family);
    if (score < bestScore) {
      bestScore = score;
      best = family;
    }
  }
  return bestScore <= 3 ? best : 'gray';
}

function closestBackgroundClassByHex(
  hex: string,
  ownerMessage?: string
): string {
  const intent = shadeIntentFromMessage(ownerMessage);
  const allowedShades = new Set(shadesForIntent(intent));
  let best = palette()[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const entry of palette()) {
    if (entry.shade != null && !allowedShades.has(entry.shade)) continue;
    const distance = rgbDistance(hex, entry.hex);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry;
    }
  }
  return best.className;
}

/**
 * Normalize any bg-* string to a valid emitable Tailwind background utility.
 */
export function normalizeTailwindBackgroundClass(
  className: string,
  ownerMessage?: string
): string {
  const trimmed = className.trim();
  if (isEmitableTailwindBackgroundClass(trimmed)) {
    return trimmed.replace(/^bg-grey-/i, 'bg-gray-').replace(/grey-/g, 'gray-');
  }

  const match = trimmed.match(/^bg-([a-z]+)(?:-(\d{2,3}))?$/i);
  if (!match) {
    return resolveTailwindBackgroundClass(trimmed, ownerMessage);
  }

  const family = match[1].toLowerCase();
  const shadeRaw = match[2] ? Number.parseInt(match[2], 10) : undefined;

  if (FLAT_COLOR_NAMES.has(family)) {
    return `bg-${family}`;
  }

  if (isShadedFamily(family)) {
    const shade =
      shadeRaw && BACKGROUND_SHADES.includes(shadeRaw as BackgroundShade)
        ? (shadeRaw as BackgroundShade)
        : shadeFromIntent(shadeIntentFromMessage(ownerMessage));
    const candidate = `bg-${family}-${shade}`;
    if (isEmitableTailwindBackgroundClass(candidate)) return candidate;
  }

  return resolveTailwindBackgroundClass(family, ownerMessage);
}

/**
 * Resolve an owner color word or class to a valid Tailwind background utility.
 */
export function resolveTailwindBackgroundClass(
  colorInput: string,
  ownerMessage?: string
): string {
  const normalized = colorInput.trim().toLowerCase();
  if (!normalized) return '';

  if (normalized.startsWith('bg-')) {
    return normalizeTailwindBackgroundClass(normalized, ownerMessage);
  }

  if (/^#[0-9a-f]{3,8}$/i.test(normalized)) {
    return closestBackgroundClassByHex(normalized, ownerMessage);
  }

  const explicitShade = normalized.match(/^([a-z]+)-(\d{2,3})$/);
  if (explicitShade) {
    const name = explicitShade[1];
    const shade = Number.parseInt(explicitShade[2], 10) as BackgroundShade;
    if (FLAT_COLOR_NAMES.has(name)) {
      return `bg-${name}`;
    }
    const alias = COLOR_WORD_ALIASES[name];
    const family = alias?.family ?? (isShadedFamily(name) ? name : closestFamilyByName(name));
    if (family === 'black' || family === 'white') {
      return `bg-${family}`;
    }
    const resolvedShade = BACKGROUND_SHADES.includes(shade) ? shade : alias?.shade;
    return classForFamilyShade(family, resolvedShade, ownerMessage);
  }

  const colorName = normalized.replace(/[^a-z]/g, '');
  if (!colorName || BACKGROUND_STYLING_META_WORDS.has(colorName)) return '';

  const alias = COLOR_WORD_ALIASES[colorName];
  if (alias) {
    return classForFamilyShade(alias.family, alias.shade, ownerMessage);
  }

  if (FLAT_COLOR_NAMES.has(colorName)) {
    return classForFamilyShade(colorName as 'black' | 'white', undefined, ownerMessage);
  }

  if (isShadedFamily(colorName)) {
    return classForFamilyShade(colorName, undefined, ownerMessage);
  }

  const closestFamily = closestFamilyByName(colorName);
  return classForFamilyShade(closestFamily, undefined, ownerMessage);
}

/** List all valid background utilities from the embedded palette. */
export function listResolvableBackgroundClasses(): string[] {
  return palette().map((entry) => entry.className);
}
