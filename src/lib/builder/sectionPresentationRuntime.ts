/**
 * Runtime helpers inlined into generated src/app/page.tsx (customer sites cannot import builder modules).
 * Keep in sync with sectionPresentation.ts.
 */
export const SECTION_PRESENTATION_RUNTIME = `
type SectionPresentation = {
  backgroundClass?: string;
  cardClass?: string;
  eyebrowClass?: string;
  titleClass?: string;
  bodyClass?: string;
};

type SectionWithPresentation = {
  type: string;
  presentation?: SectionPresentation;
};

function defaultSectionBackgroundKey(type: string): string {
  switch (type) {
    case "about":
    case "faq":
    case "gallery":
      return "mutedBg";
    case "contact":
      return "contactBg";
    default:
      return "surfaceBg";
  }
}

function pickPresentation(
  section: SectionWithPresentation,
  field: keyof SectionPresentation,
  presetKey: string,
  preset: Record<string, string>,
  fallback: string
): string {
  const override = section.presentation?.[field];
  if (typeof override === "string" && override.trim()) {
    return override.trim();
  }
  return preset[presetKey] ?? fallback;
}

function resolveSectionBackground(section: SectionWithPresentation, preset: Record<string, string>): string {
  const key = defaultSectionBackgroundKey(section.type);
  return pickPresentation(section, "backgroundClass", key, preset, preset.surfaceBg ?? "bg-white");
}

function resolveSectionCardClass(section: SectionWithPresentation, preset: Record<string, string>): string {
  return pickPresentation(section, "cardClass", "card", preset, preset.card ?? "bg-white border");
}

function resolveSectionEyebrowClass(section: SectionWithPresentation, preset: Record<string, string>): string {
  return pickPresentation(section, "eyebrowClass", "sectionEyebrow", preset, preset.sectionEyebrow ?? "text-slate-600");
}

function resolveSectionTitleClass(section: SectionWithPresentation, preset: Record<string, string>): string {
  return pickPresentation(section, "titleClass", "sectionTitle", preset, preset.sectionTitle ?? "text-slate-950");
}

function resolveSectionBodyClass(section: SectionWithPresentation, preset: Record<string, string>): string {
  return pickPresentation(section, "bodyClass", "sectionBody", preset, preset.sectionBody ?? "text-slate-600");
}
`;
