import type { SiteSectionPresentation } from '@/lib/builder/sectionPresentation';
import { findPinnedInnerCardContainer } from '@/lib/preview/targetChain';
import { isTextColorEditRequest } from '@/lib/project-workspace/verifyPreviewHints';
import type { SelectedTargetContext } from './selectedTargetContext';

export type PresentationStyleField = keyof Pick<
  SiteSectionPresentation,
  'backgroundClass' | 'cardClass' | 'eyebrowClass' | 'titleClass' | 'bodyClass'
>;

export interface InferredPresentationStyleTarget {
  presentationField: PresentationStyleField;
  label: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

const INNER_ELEMENT_PHRASES = [
  /\bcontact information\b/i,
  /\binfo (?:box|panel|card)\b/i,
  /\b(?:inner|inside)\b/i,
  /\bservice cards?\b/i,
  /\btestimonial cards?\b/i,
  /\bfaq cards?\b/i,
  /\bfaq items?\b/i,
  /\bfeature cards?\b/i,
  /\bgallery (?:photo )?(?:frames?|cards?|images?)\b/i,
  /\bphoto frames?\b/i,
  /\bimage frames?\b/i,
  /\bthe cards?\b/i,
  /\bcard backgrounds?\b/i,
];

/** Known inner labels in contact sections (not the section title). */
const CONTACT_INNER_LABELS = ['contact information', 'get in touch'];

const GENERIC_INNER_LABELS = [
  'service cards',
  'testimonial cards',
  'faq cards',
  'faq items',
  'feature cards',
  'gallery photo frames',
  'photo frames',
  'image frames',
];

function messageNamesInnerElement(
  message: string,
  sectionTitle?: string
): string | null {
  const lower = message.toLowerCase();
  for (const label of [...CONTACT_INNER_LABELS, ...GENERIC_INNER_LABELS]) {
    if (lower.includes(label)) return label;
  }
  for (const pattern of INNER_ELEMENT_PHRASES) {
    const match = message.match(pattern);
    if (match?.[0]) return match[0].trim();
  }
  const quoted = message.match(/["']([^"']+)["']/);
  if (quoted?.[1]) {
    const name = quoted[1].trim();
    if (
      sectionTitle &&
      name.toLowerCase() !== sectionTitle.toLowerCase() &&
      /\b(card|cards|panel|panels|box|boxes|item|items|info|information|button|cta)\b/i.test(name)
    ) {
      return name;
    }
  }
  if (/\bcard(s)?\b/i.test(message) && /\bbackground\b/i.test(message)) {
    return 'card';
  }
  return null;
}

/**
 * Infer which presentation token to style (section background vs inner card/element).
 */
export function inferPresentationStyleTarget(
  message: string,
  ctx?: SelectedTargetContext,
  sectionTitle?: string
): InferredPresentationStyleTarget {
  const resolvedTitle = sectionTitle ?? ctx?.resolved.sectionTitle ?? ctx?.section?.title;

  if (/\b(?:whole|entire|full)\s+section\b/i.test(message)) {
    return {
      presentationField: 'backgroundClass',
      label: 'Section background',
      confidence: 'high',
      reason: 'Owner explicitly named whole section',
    };
  }

  if (isTextColorEditRequest(message)) {
    if (/\b(?:body|subtitle|description|subheading|sub-heading)\b/i.test(message)) {
      return {
        presentationField: 'bodyClass',
        label: 'Section body text',
        confidence: 'high',
        reason: 'Owner requested body/subtitle text color',
      };
    }
    if (/\beyebrow\b/i.test(message)) {
      return {
        presentationField: 'eyebrowClass',
        label: 'Section eyebrow',
        confidence: 'high',
        reason: 'Owner requested eyebrow text color',
      };
    }
    return {
      presentationField: 'titleClass',
      label: 'Section heading',
      confidence: 'high',
      reason: 'Owner requested heading/title text color',
    };
  }

  const pinnedInnerCard = findPinnedInnerCardContainer(ctx?.target?.targetChain);
  if (pinnedInnerCard) {
    return {
      presentationField: 'cardClass',
      label: pinnedInnerCard.label || 'Contact card',
      confidence: 'high',
      reason: 'UI-pinned inner card container — use presentation.cardClass',
    };
  }

  if (ctx?.element?.fieldPath?.includes('cardClass')) {
    return {
      presentationField: 'cardClass',
      label: ctx.element.label ?? 'Pinned element',
      confidence: 'high',
      reason: 'UI-pinned element maps to cardClass',
    };
  }

  const innerName = messageNamesInnerElement(message, resolvedTitle);
  if (innerName) {
    return {
      presentationField: 'cardClass',
      label: innerName,
      confidence: 'high',
      reason: `Owner named inner element "${innerName}" — use presentation.cardClass`,
    };
  }

  if (/\b(?:section|hero)\s+background\b/i.test(message) && !/\bcard\b/i.test(message)) {
    return {
      presentationField: 'backgroundClass',
      label: 'Section background',
      confidence: 'medium',
      reason: 'Generic section background phrasing',
    };
  }

  return {
    presentationField: 'backgroundClass',
    label: 'Section background',
    confidence: 'medium',
    reason: 'Default section-level background',
  };
}

export function presentationFieldConfigPath(
  sectionIndex: number,
  field: PresentationStyleField
): string {
  return `sections[${sectionIndex}].presentation.${field}`;
}
