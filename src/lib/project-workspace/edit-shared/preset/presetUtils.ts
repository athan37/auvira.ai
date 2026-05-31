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

export type PresetScope = 'site' | 'hero' | 'background' | 'testimonialsCard';

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
        : scope === 'testimonialsCard'
          ? ['card']
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

/** Set the preset card background to a target Tailwind color. */
export function setPresetCardBackground(presetJson: string, toColor: string): string {
  const bgClass = `bg-${toColor}-500`;
  const re = /("card"\s*:\s*")([^"]*)(")/gi;
  return presetJson.replace(re, (_m, p1: string, val: string, p3: string) => {
    let newVal = val.replace(/\bbg-\w+(?:-\d+)?\b/gi, bgClass);
    if (!/\bbg-/.test(newVal)) {
      newVal = `${bgClass} ${newVal}`.trim();
    }
    return `${p1}${newVal}${p3}`;
  });
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

/** Remove quoted spans so section titles do not pollute color detection. */
export function stripQuotedSpans(message: string): string {
  return message.replace(/["'][^"']*["']/g, ' ');
}

/** Words that appear in styling phrases but are not paint colors. */
export const BACKGROUND_STYLING_META_WORDS = new Set([
  'color',
  'colour',
  'gradient',
  'gradients',
  'background',
  'backgrounds',
  'section',
  'this',
  'that',
  'change',
  'make',
  'update',
  'bg',
  'a',
  'an',
  'the',
  'flat',
  'solid',
]);

/** True when the token is a known Tailwind color name (not "color"/"gradient"). */
export function isKnownBackgroundColorWord(token: string): boolean {
  const normalized = token.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!normalized || BACKGROUND_STYLING_META_WORDS.has(normalized)) return false;
  if (TAILWIND_COLOR_NAMES.includes(normalized as TailwindColorName)) return true;
  const base = normalized.replace(/-\d{2,3}$/, '');
  return TAILWIND_COLOR_NAMES.includes(base as TailwindColorName);
}

/** True when the owner asks for a gradient section background. */
export function isGradientBackgroundRequest(message: string): boolean {
  const lower = stripQuotedSpans(message).toLowerCase();
  return (
    /\bgradient\b/.test(lower) ||
    /\b(color|colour)\s+gradient\b/.test(lower) ||
    /\bgradient\s+(color|colour|background)\b/.test(lower)
  );
}

/**
 * Parse the token after `to`, skipping filler like "color gradient" before the real hue.
 * Returns null when only filler remains (e.g. "to color gradient" with title in quotes).
 */
export function extractColorTokenAfterTo(message: string): string | null {
  const withoutQuotes = stripQuotedSpans(message);
  const toIdx = withoutQuotes.search(/\bto\b/i);
  if (toIdx < 0) return null;

  let rest = withoutQuotes.slice(toIdx + 2).trimStart();
  let modifier: string | undefined;

  while (rest.length > 0) {
    const filler = rest.match(
      /^(color|colour|gradient|background|bg|a|an|the|flat|solid)\b\s*/i
    );
    if (filler) {
      rest = rest.slice(filler[0].length).trimStart();
      continue;
    }

    const modMatch = rest.match(/^(light|dark|deep|pale|soft)\b\s*/i);
    if (modMatch) {
      modifier = modMatch[1]!.toLowerCase();
      rest = rest.slice(modMatch[0].length).trimStart();
      continue;
    }

    const colorMatch = rest.match(/^([a-z]+(?:-\d{2,3})?)\b/i);
    if (!colorMatch?.[1]) return null;

    const token = colorMatch[1].toLowerCase();
    if (BACKGROUND_STYLING_META_WORDS.has(token)) {
      rest = rest.slice(colorMatch[0].length).trimStart();
      modifier = undefined;
      continue;
    }

    if (!isKnownBackgroundColorWord(token)) return null;

    if (modifier && !token.includes('-')) {
      return `${modifier} ${token}`;
    }
    return token;
  }

  return null;
}

export function extractColorsFromMessage(message: string): string[] {
  const lower = stripQuotedSpans(message).toLowerCase();
  return TAILWIND_COLOR_NAMES.filter((c) => messageHasColorWord(lower, c));
}

/**
 * Target background color from owner message — prefers explicit `to {color}` after background/section.
 * Returns null for gradient-only requests (use extractSectionBackgroundClassFromMessage).
 */
export function extractBackgroundColorFromMessage(message: string): string | null {
  if (isGradientBackgroundRequest(message)) return null;

  const withoutQuotes = stripQuotedSpans(message);
  const swap = parseColorSwap(withoutQuotes);
  if (swap?.toColor) return swap.toColor;

  const afterTo = extractColorTokenAfterTo(message);
  if (afterTo) return afterTo;

  const colors = extractColorsFromMessage(withoutQuotes);
  return colors.length > 0 ? colors[colors.length - 1] : null;
}

/** Parse "red to yellow" / "from red to yellow" / "blue to yellow gradient" color pairs. */
export function parseColorSwap(message: string): { fromColor: string; toColor: string } | null {
  const lower = stripQuotedSpans(message).toLowerCase();

  const gradientPair = lower.match(/\b([a-z]+)\s+to\s+([a-z]+)\s+gradient\b/);
  if (gradientPair) {
    const from = gradientPair[1]!;
    const to = gradientPair[2]!;
    if (
      isKnownBackgroundColorWord(from) &&
      isKnownBackgroundColorWord(to) &&
      from !== to
    ) {
      return { fromColor: from, toColor: to };
    }
  }

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
