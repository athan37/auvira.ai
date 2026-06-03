import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';
import type { EditWhatKind } from '@/lib/project-workspace/edit-shared/types';
import {
  extractFindReplacePair,
  extractReplacementValue,
  messageTokens,
  stripPinnedTargetSuffix,
} from './configTextEditUtils';
import {
  type AllowlistedFieldEntry,
  enumerateAllowlistedFields,
  filterFieldsToSection,
} from './enumerateAllowlistedFields';
import {
  resolveContactUpdateField,
  resolveContactUpdateValue,
} from './resolveContactUpdateField';
import type { SelectedTargetContext } from './selectedTargetContext';

export type ConfigTextEditMode = 'find_replace' | 'typed_field' | 'set_field';

export interface ConfigTextEditApply {
  kind: 'apply';
  fieldPath: string;
  value: string;
  mode: ConfigTextEditMode;
  confidence: 'high' | 'medium';
  reason: string;
}

export interface ConfigTextEditClarify {
  kind: 'clarify';
  message: string;
  suggestedReplies: string[];
}

export type ConfigTextEditResult = ConfigTextEditApply | ConfigTextEditClarify | { kind: 'none' };

export interface ResolveConfigTextEditInput {
  message: string;
  siteConfigContent: string;
  pinnedSectionIndex?: number | null;
  selectedTargetContext?: SelectedTargetContext | null;
  what?: EditWhatKind;
}

const SCORE_PINNED_SECTION = 100;
const SCORE_NON_EMPTY = 10;
const SCORE_TOKEN_OVERLAP = 5;
const SCORE_CONTACT_GLOBAL = 20;
const MIN_SCORE_MARGIN = 5;

function normalizeMessage(message: string): string {
  return stripPinnedTargetSuffix(message);
}

/** Mode B: `"old" to "new"` across allowlisted fields. */
function resolveFindReplaceMode(
  message: string,
  entries: AllowlistedFieldEntry[],
  pinnedSectionIndex?: number | null
): ConfigTextEditResult {
  const pair = extractFindReplacePair(message);
  if (!pair) return { kind: 'none' };

  let candidates = entries.filter((e) => e.value.trim() === pair.find);
  if (pinnedSectionIndex != null) {
    const scoped = candidates.filter((e) => e.sectionIndex === pinnedSectionIndex);
    if (scoped.length > 0) candidates = scoped;
  }

  if (candidates.length === 0) return { kind: 'none' };
  if (candidates.length === 1) {
    return {
      kind: 'apply',
      fieldPath: candidates[0]!.fieldPath,
      value: pair.replace,
      mode: 'find_replace',
      confidence: 'high',
      reason: `Unique find/replace match for "${pair.find}"`,
    };
  }

  return buildAmbiguousFieldClarification(candidates, pair.replace);
}

/** Mode C: explicit field keywords → contact.* / hero.* / businessName. */
function resolveTypedFieldMode(message: string): ConfigTextEditApply | { kind: 'none' } {
  const normalized = normalizeMessage(message);
  const value = extractReplacementValue(message);
  if (!value) return { kind: 'none' };

  if (/\bphone\b|\bnumber\b/i.test(normalized)) {
    const phone = normalized.match(/\b(?:phone|number)\b[^0-9(+]*([(+][\d\s().-]{7,}|\d[\d\s().-]{6,})/i);
    const phoneValue = phone?.[1]?.trim() ?? value;
    return {
      kind: 'apply',
      fieldPath: 'contact.phone',
      value: phoneValue,
      mode: 'typed_field',
      confidence: 'high',
      reason: 'Typed phone field edit',
    };
  }

  if (/\bemail\b/i.test(normalized)) {
    const email = normalized.match(/\b[\w.+-]+@[\w.-]+\.\w+\b/);
    const emailValue = email?.[0] ?? value;
    return {
      kind: 'apply',
      fieldPath: 'contact.email',
      value: emailValue,
      mode: 'typed_field',
      confidence: 'high',
      reason: 'Typed email field edit',
    };
  }

  if (/\baddress\b/i.test(normalized)) {
    const address = normalized.match(/\baddress\b[^.]*[:\s]+(.+?)(?:\.|$)/i);
    const addressValue = address?.[1]?.trim() ?? value;
    return {
      kind: 'apply',
      fieldPath: 'contact.address',
      value: addressValue,
      mode: 'typed_field',
      confidence: 'high',
      reason: 'Typed address field edit',
    };
  }

  if (/\bheadline\b/i.test(normalized)) {
    return {
      kind: 'apply',
      fieldPath: 'hero.headline',
      value,
      mode: 'typed_field',
      confidence: 'high',
      reason: 'Typed hero headline edit',
    };
  }

  if (/\bsubheadline\b|\btagline\b/i.test(normalized)) {
    const field = /\btagline\b/i.test(normalized) ? 'tagline' : 'subheadline';
    return {
      kind: 'apply',
      fieldPath: `hero.${field}`,
      value,
      mode: 'typed_field',
      confidence: 'high',
      reason: `Typed hero ${field} edit`,
    };
  }

  if (/\bbusiness\s+name\b/i.test(normalized) || (/\bname\b/i.test(normalized) && /\bbusiness\b/i.test(normalized))) {
    return {
      kind: 'apply',
      fieldPath: 'businessName',
      value,
      mode: 'typed_field',
      confidence: 'high',
      reason: 'Typed business name edit',
    };
  }

  return { kind: 'none' };
}

function scoreFieldCandidate(
  entry: AllowlistedFieldEntry,
  tokens: string[],
  pinnedSectionIndex?: number | null,
  mentionsContactField?: boolean,
  mentionsContactPanel?: boolean
): number {
  let score = 0;
  if (pinnedSectionIndex != null && entry.sectionIndex === pinnedSectionIndex) {
    score += SCORE_PINNED_SECTION;
  }
  if (entry.value.trim()) score += SCORE_NON_EMPTY;

  for (const token of tokens) {
    if (entry.labels.some((label) => label.includes(token) || token.includes(label))) {
      score += SCORE_TOKEN_OVERLAP;
    }
  }

  if (
    mentionsContactPanel &&
    entry.sectionType === 'contact' &&
    entry.field === 'subtitle'
  ) {
    score += 50;
  }

  if (entry.scope === 'contact' && mentionsContactField) {
    score += SCORE_CONTACT_GLOBAL;
  }

  if (entry.scope === 'contact' && !mentionsContactField && pinnedSectionIndex != null) {
    score -= SCORE_CONTACT_GLOBAL;
  }

  return score;
}

function buildAmbiguousFieldClarification(
  candidates: AllowlistedFieldEntry[],
  newValue: string
): ConfigTextEditClarify {
  const top = candidates.slice(0, 5);
  const lines = top.map((c, i) => `${i + 1}. ${c.fieldPath} = "${c.value.slice(0, 60)}${c.value.length > 60 ? '…' : ''}"`);
  return {
    kind: 'clarify',
    message:
      `That text appears in multiple fields. Which should I update to "${newValue}"?\n\n` +
      lines.join('\n'),
    suggestedReplies: top.map((_, i) => String(i + 1)),
  };
}

/** Mode A: pinned section + implicit target + replacement value. */
function resolveSetFieldMode(
  message: string,
  entries: AllowlistedFieldEntry[],
  input: ResolveConfigTextEditInput
): ConfigTextEditResult {
  const what = input.what ?? classifyEditWhat(message);
  if (what !== 'copy') return { kind: 'none' };

  const value = extractReplacementValue(message);
  if (!value) return { kind: 'none' };

  const ctx = input.selectedTargetContext;
  if (ctx?.element?.fieldPath) {
    return {
      kind: 'apply',
      fieldPath: ctx.element.fieldPath,
      value,
      mode: 'set_field',
      confidence: 'high',
      reason: 'UI-pinned element field path',
    };
  }

  const pinnedSectionIndex = input.pinnedSectionIndex ?? ctx?.resolved.sectionIndex;
  const normalized = normalizeMessage(message);
  const mentionsContactField = /\b(phone|number|email|address)\b/i.test(normalized);
  const mentionsContactPanel = /\bcontact\s+information\b|\bcontact\s+info\b/i.test(normalized);

  if (mentionsContactField) return { kind: 'none' };

  let candidates = entries;
  if (pinnedSectionIndex != null) {
    candidates = filterFieldsToSection(entries, pinnedSectionIndex);
  }

  if (candidates.length === 0) return { kind: 'none' };

  const tokens = messageTokens(message);
  const scored = candidates
    .map((entry) => ({
      entry,
      score: scoreFieldCandidate(
        entry,
        tokens,
        pinnedSectionIndex,
        mentionsContactField,
        mentionsContactPanel
      ),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    if (pinnedSectionIndex != null && ctx?.recommendedDefaultField?.fieldPath) {
      return {
        kind: 'apply',
        fieldPath: ctx.recommendedDefaultField.fieldPath,
        value,
        mode: 'set_field',
        confidence: 'medium',
        reason: ctx.recommendedDefaultField.reason,
      };
    }
    return { kind: 'none' };
  }

  const top = scored[0]!;
  const second = scored[1];
  if (second && top.score - second.score < MIN_SCORE_MARGIN) {
    return buildAmbiguousFieldClarification(
      scored.slice(0, 5).map((s) => s.entry),
      value
    );
  }

  return {
    kind: 'apply',
    fieldPath: top.entry.fieldPath,
    value,
    mode: 'set_field',
    confidence: top.score >= SCORE_PINNED_SECTION ? 'high' : 'medium',
    reason: `Scored field match (${top.score}) for pinned copy edit`,
  };
}

/**
 * Unified config copy resolver (Modes B → C → A).
 */
export function resolveConfigTextEdit(input: ResolveConfigTextEditInput): ConfigTextEditResult {
  const { message, siteConfigContent } = input;
  if (!siteConfigContent.trim()) return { kind: 'none' };

  const entries = enumerateAllowlistedFields(siteConfigContent);
  if (entries.length === 0) return { kind: 'none' };

  const pinnedSectionIndex = input.pinnedSectionIndex ?? input.selectedTargetContext?.resolved.sectionIndex;

  const findReplace = resolveFindReplaceMode(message, entries, pinnedSectionIndex);
  if (findReplace.kind !== 'none') return findReplace;

  const typed = resolveTypedFieldMode(message);
  if (typed.kind === 'apply') return typed;

  return resolveSetFieldMode(message, entries, input);
}

/** Map legacy skill + params to canonical fieldPath for verification. */
export function fieldPathFromPlanStep(
  skill: string,
  merged: Record<string, unknown>,
  message?: string
): string | undefined {
  if (merged.fieldPath && String(merged.fieldPath).trim()) {
    return String(merged.fieldPath).trim();
  }

  if (skill === 'update_business_name') return 'businessName';

  if (skill === 'update_hero') {
    const field = String(merged.field ?? 'headline');
    return `hero.${field}`;
  }

  if (skill === 'update_contact') {
    const field = resolveContactUpdateField(
      merged,
      message ? stripPinnedTargetSuffix(message) : undefined
    );
    return `contact.${field}`;
  }

  const sectionIndex = merged.sectionIndex;
  const field = merged.field;
  if (
    (skill === 'update_section_copy' || skill === 'update_section_item_copy' || skill === 'update_cta_label') &&
    sectionIndex != null &&
    field
  ) {
    const idx = Number(sectionIndex);
    if (skill === 'update_section_item_copy' && merged.itemIndex != null) {
      return `sections[${idx}].items[${merged.itemIndex}].${field}`;
    }
    return `sections[${idx}].${field}`;
  }

  return undefined;
}

export function valueFromPlanStep(skill: string, merged: Record<string, unknown>, fieldPath?: string): string | undefined {
  if (merged.value != null && String(merged.value).trim()) {
    return String(merged.value).trim();
  }
  if (fieldPath?.startsWith('contact.')) {
    const field = resolveContactUpdateField(merged);
    return resolveContactUpdateValue(merged, field);
  }
  const field = fieldPath?.split('.').pop() ?? merged.field;
  if (field && merged[field as string] != null) {
    return String(merged[field as string]).trim();
  }
  return undefined;
}
