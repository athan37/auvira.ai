/**
 * Extract a safe CSS color value from LLM-generated strings.
 * Handles prose like "Bright Red (#FF0000) - background" → "#FF0000"
 */

const HEX_6 = /^#([0-9A-Fa-f]{6})$/;
const HEX_3 = /^#([0-9A-Fa-f]{3})$/;

function expandHex3(short: string): string {
  const h = short.slice(1);
  return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toUpperCase();
}

/**
 * Parse a single color string into a valid CSS hex color, or null if none found.
 */
export function extractCssColor(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (HEX_6.test(trimmed)) return trimmed.toUpperCase();
  if (HEX_3.test(trimmed)) return expandHex3(trimmed);

  const hexMatch = trimmed.match(/#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/);
  if (hexMatch) {
    const raw = `#${hexMatch[1]}`;
    return HEX_3.test(raw) ? expandHex3(raw) : raw.toUpperCase();
  }

  const rgbMatch = trimmed.match(
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/
  );
  if (rgbMatch) {
    const r = Math.min(255, parseInt(rgbMatch[1], 10));
    const g = Math.min(255, parseInt(rgbMatch[2], 10));
    const b = Math.min(255, parseInt(rgbMatch[3], 10));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
  }

  return null;
}

/**
 * Normalize an array of color strings to valid hex values only.
 */
export function normalizeSiteSpecColors(colors?: string[]): string[] {
  if (!colors?.length) return [];
  const out: string[] = [];
  for (const c of colors) {
    const hex = extractCssColor(c);
    if (hex && !out.includes(hex)) out.push(hex);
  }
  return out;
}

/**
 * Pick the first usable background color from site spec colors.
 */
export function pickBackgroundColor(
  siteSpecColors?: string[],
  fallback = '#F8FAFC'
): string {
  const normalized = normalizeSiteSpecColors(siteSpecColors);
  return normalized[0] || fallback;
}
