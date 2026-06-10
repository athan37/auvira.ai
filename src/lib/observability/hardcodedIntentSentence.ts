import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';
import {
  detectImplicitPhrases,
  extractExplicitColorValue,
  extractExplicitQuotedValue,
} from '@/lib/project-workspace/edit-context/implicitReferencePhrases';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import type { ObservabilityProjectIntent } from './types';

const FAVORITE_COLOR_PATTERN =
  /\bmy\s+(?:favorite|favourite|faviorite|faviourite)\s+colou?r\b/i;

type PresentationField = 'backgroundClass' | 'cardClass';

/** Dev-only default when favorite color is requested but not stated in the message. */
export function devDefaultFavoriteColor(): string | null {
  const raw = process.env.OBSERVABILITY_INTENT_DEV_FAVORITE_COLOR?.trim();
  if (raw === '' || raw === 'none') return null;
  return raw || 'green';
}

function sectionLabel(target: SelectedTargetInput | null | undefined): string {
  if (target?.sectionTitle?.trim()) return target.sectionTitle.trim();
  if (typeof target?.sectionIndex === 'number') return `section ${target.sectionIndex}`;
  return 'the pinned section';
}

function elementLabel(target: SelectedTargetInput | null | undefined): string | null {
  const label = target?.elementLabel?.trim();
  return label || null;
}

function inferPresentationField(
  target: SelectedTargetInput | null | undefined,
  editKind: ReturnType<typeof classifyEditWhat>
): PresentationField {
  const path = target?.fieldPath?.toLowerCase() ?? '';
  if (path.includes('cardclass')) return 'cardClass';
  if (path.includes('backgroundclass')) return 'backgroundClass';
  if (editKind === 'style_card') return 'cardClass';
  const el = elementLabel(target)?.toLowerCase() ?? '';
  if (/\b(card|contact information|inner|panel)\b/.test(el)) return 'cardClass';
  return 'backgroundClass';
}

function buildConfigFieldPath(
  target: SelectedTargetInput | null | undefined,
  field: PresentationField
): string {
  if (target?.fieldPath?.trim()) return target.fieldPath.trim();
  if (target?.kind === 'hero') {
    return field === 'backgroundClass'
      ? 'hero.presentation.backgroundClass'
      : `hero.presentation.${field}`;
  }
  const idx = typeof target?.sectionIndex === 'number' ? target.sectionIndex : 0;
  return `sections[${idx}].presentation.${field}`;
}

function colorToGradientClass(color: string): string {
  const normalized = color.trim().toLowerCase();
  if (normalized.startsWith('gradient-')) return normalized;
  if (normalized.startsWith('bg-')) return normalized;
  if (/^#[0-9a-f]{3,8}$/i.test(normalized)) return normalized;
  return `gradient-${normalized}`;
}

function formatChainHint(target: SelectedTargetInput | null | undefined): string {
  const chain = target?.targetChain;
  if (!chain?.length) return '';
  const labels = chain.map((node) => node.label).filter(Boolean);
  if (labels.length === 0) return '';
  return ` Pinned target chain: ${labels.join(' → ')}.`;
}

function buildStyleIntentSentence(input: {
  userMessage: string;
  target: SelectedTargetInput | null | undefined;
  editKind: ReturnType<typeof classifyEditWhat>;
}): ObservabilityProjectIntent {
  const { userMessage, target, editKind } = input;
  const field = inferPresentationField(target, editKind);
  const fieldPath = buildConfigFieldPath(target, field);
  const label = sectionLabel(target);
  const pin = elementLabel(target);
  const chain = formatChainHint(target);

  const explicitColor = extractExplicitColorValue(userMessage);
  const wantsFavorite = FAVORITE_COLOR_PATTERN.test(userMessage);

  if (wantsFavorite && !explicitColor) {
    const favorite = devDefaultFavoriteColor();
    if (!favorite) {
      return {
        sentence: `Change the ${label} ${field === 'cardClass' ? 'contact card' : 'section'} background (${fieldPath}) to the owner's favorite color; color not yet known from project history.${chain}`,
      };
    }
    const gradient = colorToGradientClass(favorite);
    const pinClause = pin ? ` Apply to pinned element "${pin}" only.` : '';
    return {
      sentence: `Change the ${label} ${field === 'cardClass' ? 'inner contact card' : 'section'} background by setting ${fieldPath} to "${gradient}" because the owner's favorite color is ${favorite}; do not change other sections or outer section backgrounds.${pinClause}${chain}`,
    };
  }

  const color = explicitColor ?? extractExplicitColorValue(userMessage);
  if (color) {
    const gradient = colorToGradientClass(color);
    const surface =
      field === 'cardClass' ? 'inner contact card background' : 'section background';
    const pinClause = pin ? ` Target the pinned element "${pin}" at ${fieldPath}.` : '';
    return {
      sentence: `Change the ${label} ${surface} by setting ${fieldPath} to "${gradient}" as requested in the owner message "${userMessage.trim()}".${pinClause}${chain}`,
    };
  }

  return {
    sentence: `Change presentation styling on ${fieldPath} for the ${label} section per the owner request "${userMessage.trim()}"; specify a concrete color or style class.${chain}`,
  };
}

function buildCopyIntentSentence(input: {
  userMessage: string;
  target: SelectedTargetInput | null | undefined;
}): ObservabilityProjectIntent {
  const { userMessage, target } = input;
  const quoted = extractExplicitQuotedValue(userMessage);
  const fieldPath =
    target?.fieldPath?.trim() ??
    (target?.kind === 'hero' ? 'hero.headline' : `sections[${target?.sectionIndex ?? 0}].title`);
  const label = elementLabel(target) ?? sectionLabel(target);
  const chain = formatChainHint(target);

  if (quoted) {
    return {
      sentence: `Change the text at ${fieldPath} (pinned "${label}") to "${quoted}" exactly as stated in the owner message; update only that field, not neighboring copy.${chain}`,
    };
  }

  return {
    sentence: `Update copy at ${fieldPath} for pinned "${label}" per the owner message "${userMessage.trim()}"; use the stated wording from the message.${chain}`,
  };
}

function buildCtaIntentSentence(input: {
  userMessage: string;
  target: SelectedTargetInput | null | undefined;
}): ObservabilityProjectIntent {
  const { userMessage, target } = input;
  const quoted = extractExplicitQuotedValue(userMessage);
  const fieldPath = target?.fieldPath?.trim() ?? 'hero.primaryCta';
  const label = elementLabel(target) ?? 'primary CTA button';
  const chain = formatChainHint(target);
  const value = quoted ?? 'the CTA text from the owner message';

  return {
    sentence: `Change the ${label} at ${fieldPath} to ${quoted ? `"${quoted}"` : value}; apply only to that button label.${chain}`,
  };
}

/**
 * Build a detailed single-sentence intent for local testing until Monitor POST /intent is live.
 * Sentences include field paths, concrete values, and pin labels so the planner needs no inference.
 */
export function buildHardcodedIntentSentence(input: {
  userMessage: string;
  selectedTarget?: SelectedTargetInput | null;
}): ObservabilityProjectIntent {
  const userMessage = input.userMessage.trim();
  const target = input.selectedTarget ?? null;
  const editKind = classifyEditWhat(userMessage);
  const implicit = detectImplicitPhrases(userMessage);

  if (implicit.some((hit) => hit.kind === 'cta') || /\bcta\b/i.test(userMessage)) {
    return buildCtaIntentSentence({ userMessage, target });
  }

  if (
    editKind === 'copy' ||
    (/\b(headline|title|wording|copy|rename|text)\b/i.test(userMessage) && !/\bcolou?r\b/i.test(userMessage))
  ) {
    return buildCopyIntentSentence({ userMessage, target });
  }

  if (
    editKind === 'style_background' ||
    editKind === 'style_card' ||
    editKind === 'style_text' ||
    implicit.some((hit) => hit.kind === 'color')
  ) {
    return buildStyleIntentSentence({ userMessage, target, editKind });
  }

  const fieldPath =
    target?.fieldPath?.trim() ??
    (target?.kind === 'hero'
      ? 'hero'
      : `sections[${typeof target?.sectionIndex === 'number' ? target.sectionIndex : 0}]`);
  const chain = formatChainHint(target);

  return {
    sentence: `Apply the owner structural edit request "${userMessage}" on ${fieldPath}; follow pinned target scope only.${chain}`,
  };
}
