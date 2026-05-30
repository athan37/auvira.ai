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

/** Map a color name from owner chat to a Tailwind background utility class. */
export function colorNameToBackgroundClass(
  color: string,
  ownerMessage?: string
): string {
  const normalized = color.trim().toLowerCase();
  if (normalized.startsWith('bg-')) return normalized;

  const explicitShade = normalized.match(/^([a-z]+)-(\d{2,3})$/);
  if (explicitShade) {
    return `bg-${explicitShade[1]}-${explicitShade[2]}`;
  }

  const colorName = normalized.replace(/[^a-z]/g, '');
  const msg = (ownerMessage ?? '').toLowerCase();
  if (/\b(light|pale|soft|pastel)\b/.test(msg)) {
    return `bg-${colorName}-200`;
  }
  if (/\b(dark|deep|rich)\b/.test(msg)) {
    return `bg-${colorName}-800`;
  }
  return `bg-${colorName}-600`;
}

/** Map a color name to Tailwind classes for cards in a section. */
export function colorNameToCardClass(color: string): string {
  const normalized = color.trim().toLowerCase();
  if (normalized.includes('border-') || normalized.includes('bg-')) return normalized;
  return `border-${normalized}-300 bg-${normalized}-50`;
}
