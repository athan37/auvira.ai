import {
  colorNameToBackgroundClass,
  colorNameToCardClass,
  type SiteSectionPresentation,
} from '@/lib/builder/sectionPresentation';
import { extractColorsFromMessage } from '../website-edit-agent/preset/presetUtils';
import type { SiteModel, SiteModelSection } from './siteModel';
import type { EditPlan, EditPlanStep } from './editPlanSchema';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Resolve section index from owner message and site model section titles/types. */
export function resolveSectionIndexFromMessage(
  message: string,
  sections: SiteModelSection[]
): number | null {
  const lower = message.toLowerCase();

  if (/\bfirst section\b/.test(lower)) {
    return sections[0]?.index ?? 0;
  }

  for (const section of sections) {
    const title = section.title?.trim();
    if (title && lower.includes(title.toLowerCase())) {
      return section.index;
    }
  }

  if (/\b(gallery|hello)\b/.test(lower)) {
    const gallery = sections.find(
      (s) => s.type === 'gallery' || s.title?.toLowerCase() === 'hello'
    );
    if (gallery) return gallery.index;
  }

  if (/\babout\b/.test(lower)) {
    const about = sections.find((s) => s.type === 'about');
    if (about) return about.index;
  }

  if (/\btestimonial/.test(lower) || /\bcustomers say\b/.test(lower)) {
    const testimonials = sections.find((s) => s.type === 'testimonials');
    if (testimonials) return testimonials.index;
  }

  if (/\bservices\b/.test(lower)) {
    const services = sections.find((s) => s.type === 'services');
    if (services) return services.index;
  }

  return null;
}

function wantsCardStyle(message: string): boolean {
  return /\bcard(s)?\b/i.test(message);
}

function wantsBackgroundStyle(message: string): boolean {
  return /\bbackground\b/i.test(message) && !wantsCardStyle(message);
}

/**
 * Fill missing update_section_style args when the LLM omits required fields.
 */
export function normalizeSectionStyleStep(
  step: EditPlanStep,
  ownerMessage: string,
  siteModel: SiteModel
): EditPlanStep {
  if (step.skill !== 'update_section_style') return step;

  const args = { ...step.args };
  const record = asRecord(args);

  let sectionIndex = readNumber(record, 'sectionIndex');
  if (sectionIndex == null) {
    sectionIndex = resolveSectionIndexFromMessage(ownerMessage, siteModel.sections);
    if (sectionIndex != null) {
      args.sectionIndex = sectionIndex;
    }
  }

  const colors = extractColorsFromMessage(ownerMessage);
  const color = readString(record, 'backgroundColor') ?? readString(record, 'color') ?? colors.at(-1);

  let presentation = asRecord(record.presentation) as Partial<SiteSectionPresentation>;

  if (wantsCardStyle(ownerMessage) && color && !presentation.cardClass) {
    presentation = { ...presentation, cardClass: colorNameToCardClass(color) };
  }

  if (
    (wantsBackgroundStyle(ownerMessage) || /\b(background|section)\b/i.test(ownerMessage)) &&
    color &&
    !presentation.backgroundClass &&
    !readString(record, 'backgroundColor')
  ) {
    args.backgroundColor = color;
  }

  if (Object.keys(presentation).length > 0) {
    args.presentation = presentation;
  }

  return { ...step, args };
}

/**
 * Normalize all update_section_style steps using site context.
 */
export function normalizeEditPlanSectionStyles(
  plan: EditPlan,
  ownerMessage: string,
  siteModel: SiteModel
): EditPlan {
  return {
    ...plan,
    steps: plan.steps.map((step) => normalizeSectionStyleStep(step, ownerMessage, siteModel)),
  };
}
