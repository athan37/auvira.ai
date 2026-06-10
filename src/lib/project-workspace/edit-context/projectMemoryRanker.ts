import type {
  EditPatternValue,
  ObservabilityProjectMemory,
  ProjectMemoryScope,
  ProjectMemorySlot,
  ProjectMemorySlotKind,
} from '@/lib/observability/types';
import type { EditContext } from './types';
import type { ExtractedImplicitRef, ImplicitScopeHint } from './extractImplicitReferences';
import type { ImplicitReferenceKind } from './implicitReferenceTypes';

export interface MemoryEvidenceCandidate {
  value: string;
  source: 'project_memory';
  reason: string;
  slot: ProjectMemorySlot;
}

const KIND_MAP: Record<ImplicitReferenceKind, ProjectMemorySlotKind[]> = {
  color: ['color', 'style_token'],
  style: ['style_token', 'edit_pattern'],
  copy: ['copy', 'edit_pattern'],
  cta: ['cta', 'copy'],
  offer: ['copy', 'edit_pattern'],
  edit_pattern: ['edit_pattern'],
  section_reference: ['edit_pattern'],
  unknown: ['edit_pattern', 'color', 'copy', 'cta', 'style_token'],
};

function slotValueToString(value: string | EditPatternValue): string {
  if (typeof value === 'string') return value;
  const params = value.params ? JSON.stringify(value.params) : '';
  return `${value.what}${params ? `: ${params}` : ''}`;
}

function formatEditPatternValue(value: EditPatternValue): string {
  const parts = [value.what];
  if (value.params?.backgroundClass) parts.push(String(value.params.backgroundClass));
  if (value.params?.presentationField) parts.push(String(value.params.presentationField));
  if (value.params?.value) parts.push(String(value.params.value));
  return parts.join(' · ');
}

export function formatMemorySlotForDisplay(slot: ProjectMemorySlot): string {
  if (slot.kind === 'edit_pattern' && typeof slot.value === 'object') {
    return formatEditPatternValue(slot.value);
  }
  return typeof slot.value === 'string' ? slot.value : slotValueToString(slot.value);
}

function scopeScore(
  slotScope: ProjectMemoryScope,
  hint: ImplicitScopeHint | undefined,
  editContext: EditContext
): number {
  let score = 0;
  const target = editContext.target;
  const pinnedIndex =
    editContext.selectedTargetContext?.resolved.sectionIndex ??
    (target.sectionIndex != null ? target.sectionIndex : undefined);
  const pinnedType =
    editContext.selectedTargetContext?.resolved.sectionType ?? target.sectionType;

  if (hint === 'hero' && slotScope.type === 'hero') score += 40;
  if (hint === 'this_section' && slotScope.type === 'section_index' && pinnedIndex != null) {
    if (slotScope.sectionIndex === pinnedIndex) score += 50;
    else score -= 10;
  }
  if (hint === 'this_section' && slotScope.type === 'section_type' && pinnedType) {
    if (slotScope.sectionType === pinnedType) score += 45;
  }
  if (hint === 'project' && slotScope.type === 'project') score += 30;
  if (!hint && slotScope.type === 'project') score += 10;

  if (pinnedIndex != null && slotScope.type === 'section_index') {
    score += slotScope.sectionIndex === pinnedIndex ? 35 : -5;
  }
  if (pinnedType && slotScope.type === 'section_type') {
    score += slotScope.sectionType === pinnedType ? 30 : 0;
  }
  if (target.kind === 'hero' && slotScope.type === 'hero') score += 25;

  return score;
}

function phraseAliasScore(slot: ProjectMemorySlot, phrase: string): number {
  const lower = phrase.toLowerCase();
  for (const alias of slot.phrase_aliases) {
    const a = alias.toLowerCase();
    if (a === lower) return 20;
    if (lower.includes(a) || a.includes(lower)) return 10;
  }
  return 0;
}

/** Rank Monitor memory slots for a detected implicit reference. */
export function rankProjectMemorySlots(
  memory: ObservabilityProjectMemory | null | undefined,
  ref: ExtractedImplicitRef,
  editContext: EditContext
): MemoryEvidenceCandidate[] {
  if (!memory?.slots.length) return [];

  const allowedKinds = KIND_MAP[ref.kind] ?? KIND_MAP.unknown;

  const scored = memory.slots
    .filter((slot) => allowedKinds.includes(slot.kind))
    .map((slot) => {
      const score =
        scopeScore(slot.scope, ref.scopeHint, editContext) +
        phraseAliasScore(slot, ref.phrase) +
        (slot.kind === 'edit_pattern' && ref.kind === 'edit_pattern' ? 15 : 0);
      return { slot, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map(({ slot }) => ({
    value:
      slot.kind === 'edit_pattern' && typeof slot.value === 'object'
        ? formatEditPatternValue(slot.value)
        : slotValueToString(slot.value),
    source: 'project_memory' as const,
    reason: `Project memory slot (${slot.kind}, scope ${slot.scope.type})`,
    slot,
  }));
}

/** Slots scoped to current edit target for planner prompt (cap N). */
export function selectMemorySlotsForPlanner(
  memory: ObservabilityProjectMemory | null | undefined,
  editContext: EditContext,
  max = 8
): ProjectMemorySlot[] {
  if (!memory?.slots.length) return [];

  const target = editContext.target;
  const pinnedIndex = target.sectionIndex;
  const pinnedType = target.sectionType;

  const scored = memory.slots.map((slot) => ({
    slot,
    score: scopeScore(slot.scope, undefined, editContext),
  }));

  scored.sort((a, b) => b.score - a.score);

  const filtered =
    pinnedIndex != null || pinnedType ? scored.filter((entry) => entry.score > 0) : scored;

  return filtered.slice(0, max).map((entry) => entry.slot);
}
