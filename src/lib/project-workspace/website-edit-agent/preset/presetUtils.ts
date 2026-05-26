/** Shared preset extraction and Tailwind color token replacement for L0 theme edits. */

export const TAILWIND_COLOR_NAMES = [
  'green',
  'yellow',
  'blue',
  'red',
  'orange',
  'purple',
  'pink',
  'brown',
  'black',
  'white',
  'teal',
  'cyan',
  'indigo',
  'gray',
  'grey',
] as const;

export type TailwindColorName = (typeof TAILWIND_COLOR_NAMES)[number];

export const PRESET_BACKGROUND_KEYS = [
  'pageBg',
  'heroBg',
  'surfaceBg',
  'mutedBg',
  'navBg',
  'contactBg',
  'footerBg',
] as const;

export const PRESET_TEXT_KEYS = [
  'navText',
  'heroText',
  'heroMutedText',
  'heroEyebrow',
  'sectionTitle',
  'sectionBody',
  'sectionEyebrow',
  'footerAccent',
] as const;

export type PresetScope = 'site' | 'hero' | 'background';

/** Extract inline `const preset = { ... }` JSON (single-line or multiline). */
export function extractPresetObjectLiteral(pageContent: string): string | null {
  const marker = pageContent.indexOf('const preset = ');
  if (marker < 0) return null;
  const start = pageContent.indexOf('{', marker);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < pageContent.length; i++) {
    const ch = pageContent[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return pageContent.slice(start, i + 1);
    }
  }
  return null;
}

/** Replace the preset object literal inside page.tsx content. */
export function replacePresetInPageContent(pageContent: string, newPresetJson: string): string | null {
  const marker = pageContent.indexOf('const preset = ');
  if (marker < 0) return null;
  const start = pageContent.indexOf('{', marker);
  if (start < 0) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < pageContent.length; i++) {
    const ch = pageContent[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) return null;
  return pageContent.slice(0, start) + newPresetJson + pageContent.slice(end);
}

/** Swap Tailwind color tokens (bg-, text-, from-, to-, via-) in a string. */
export function swapTailwindColorInText(
  text: string,
  fromColor: string,
  toColor: string
): string {
  if (fromColor === toColor) return text;
  const from = fromColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const to = toColor;
  return text.replace(
    new RegExp(`\\b((?:bg|text|from|to|via)-)${from}(-[0-9]{2,3})?\\b`, 'gi'),
    (_match, prefix: string, shade?: string) => `${prefix}${to}${shade ?? ''}`
  );
}

/** Apply color swap to all preset JSON string values. */
export function swapColorsInPresetJson(
  presetJson: string,
  fromColor: string,
  toColor: string,
  scope: PresetScope
): string {
  let out = presetJson;
  const bgKeys =
    scope === 'hero'
      ? ['heroBg', 'heroOverlay']
      : scope === 'background'
        ? ['pageBg', 'heroBg', 'surfaceBg', 'mutedBg']
        : [...PRESET_BACKGROUND_KEYS];

  for (const key of bgKeys) {
    const re = new RegExp(`("${key}"\\s*:\\s*")([^"]*)(")`, 'gi');
    out = out.replace(re, (_m, p1: string, val: string, p3: string) => {
      return `${p1}${swapTailwindColorInText(val, fromColor, toColor)}${p3}`;
    });
  }

  if (scope === 'site') {
    for (const key of PRESET_TEXT_KEYS) {
      const re = new RegExp(`("${key}"\\s*:\\s*")([^"]*)(")`, 'gi');
      out = out.replace(re, (_m, p1: string, val: string, p3: string) => {
        return `${p1}${swapTailwindColorInText(val, fromColor, toColor)}${p3}`;
      });
    }
  }

  return out;
}

/** Set text-* preset keys to a target text color class. */
export function setPresetTextColorKeys(
  presetJson: string,
  toColor: string,
  keys: readonly string[] = PRESET_TEXT_KEYS
): string {
  const textClass = `text-${toColor}`;
  let out = presetJson;
  for (const key of keys) {
    const re = new RegExp(`("${key}"\\s*:\\s*")([^"]*)(")`, 'gi');
    out = out.replace(re, `$1${textClass}$3`);
  }
  return out;
}

export function messageHasColorWord(message: string, color: string): boolean {
  const escaped = color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(message);
}

export function extractColorsFromMessage(message: string): string[] {
  const lower = message.toLowerCase();
  return TAILWIND_COLOR_NAMES.filter((c) => messageHasColorWord(lower, c));
}

/** Parse "red to yellow" / "from red to yellow" style swaps. */
export function parseColorSwap(message: string): { fromColor: string; toColor: string } | null {
  const lower = message.toLowerCase();
  const explicit = lower.match(/\bfrom\s+(\w+)\s+to\s+(\w+)\b/);
  if (explicit) {
    const from = explicit[1];
    const to = explicit[2];
    if (
      TAILWIND_COLOR_NAMES.includes(from as TailwindColorName) &&
      TAILWIND_COLOR_NAMES.includes(to as TailwindColorName)
    ) {
      return { fromColor: from, toColor: to };
    }
  }

  const colors = extractColorsFromMessage(message);
  if (colors.length >= 2) {
    const toMatch = lower.match(/\bto\s+(\w+)\b/);
    if (toMatch && colors.includes(toMatch[1])) {
      const toColor = toMatch[1];
      const fromColor = colors.find((c) => c !== toColor);
      if (fromColor) return { fromColor, toColor };
    }
    return { fromColor: colors[0], toColor: colors[colors.length - 1] };
  }

  if (colors.length === 1 && /\bto\s+(\w+)\b/.test(lower)) {
    const toMatch = lower.match(/\bto\s+(\w+)\b/);
    if (toMatch && colors.includes(toMatch[1])) {
      return { fromColor: colors[0], toColor: toMatch[1] };
    }
  }

  return null;
}
