import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import type { EditPatternValue, ProjectMemoryScope, ProjectMemorySlot } from '@/lib/observability/types';
import type { EditPlan, EditStep } from '@/lib/project-workspace/planner/editPlan.schema';
import type { EditContext } from './types';
import { detectImplicitPhrases } from './implicitReferencePhrases';
import type { ImplicitReferenceRecord } from './implicitReferenceTypes';

const MAX_ALIASES = 5;

type MemorySlotWrite = Omit<ProjectMemorySlot, 'id' | 'updated_at'>;

function uniqueAliases(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 80) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_ALIASES) break;
  }
  return out;
}

function inferAliasesFromMessage(ownerMessage: string, kind: string): string[] {
  const detected = detectImplicitPhrases(ownerMessage);
  const aliases = detected
    .filter((d) => d.kind === kind || kind === 'edit_pattern')
    .map((d) => d.phrase);
  if (/\bfavorite\b/i.test(ownerMessage)) aliases.push('my favorite');
  if (/\busual\b/i.test(ownerMessage)) aliases.push('our usual');
  if (/\bmy way\b/i.test(ownerMessage)) aliases.push('my favorite way to edit');
  return uniqueAliases(aliases);
}

function scopeForTarget(editContext: EditContext, fieldPath?: string): ProjectMemoryScope {
  const target = editContext.target;
  if (target.kind === 'hero') return { type: 'hero' };
  if (fieldPath?.trim()) return { type: 'field', fieldPath: fieldPath.trim() };
  if (target.sectionIndex != null && target.sectionType) {
    return { type: 'section_type', sectionType: target.sectionType };
  }
  if (target.sectionIndex != null) {
    return { type: 'section_index', sectionIndex: target.sectionIndex };
  }
  return { type: 'project' };
}

function editPatternFromStep(step: EditStep): EditPatternValue | null {
  const params = step.params ?? {};
  switch (step.skill) {
    case 'update_section_style':
      return {
        what: params.presentationField === 'cardClass' ? 'style_card' : 'style_background',
        params,
      };
    case 'update_theme':
      return { what: 'style_background', params };
    case 'update_config_field':
    case 'update_section_copy':
    case 'update_section_item_copy':
      return { what: 'copy', params };
    case 'update_hero':
      return { what: 'copy', params };
    case 'update_contact':
      return { what: 'copy', params };
    case 'add_section_item':
    case 'remove_section_item':
    case 'duplicate_section_item':
      return { what: 'structure', params };
    default:
      return null;
  }
}

function slotFromStyleDiff(
  editContext: EditContext,
  beforeFiles: Record<string, string>,
  afterFiles: Record<string, string>
): MemorySlotWrite[] {
  const siteConfigPath = Object.keys(afterFiles).find((f) => /siteConfig\.ts$/i.test(f));
  if (!siteConfigPath) return [];

  const beforeSite = beforeFiles[siteConfigPath] ?? '';
  const afterSite = afterFiles[siteConfigPath] ?? '';
  if (!beforeSite || !afterSite || beforeSite === afterSite) return [];

  const beforeParsed = parseSiteConfigSource(beforeSite);
  const afterParsed = parseSiteConfigSource(afterSite);
  const sections = afterParsed?.sections ?? [];
  const slots: MemorySlotWrite[] = [];

  for (let i = 0; i < sections.length; i++) {
    const afterSection = sections[i] as {
      type?: string;
      presentation?: { backgroundClass?: string };
    };
    const beforeSection = beforeParsed?.sections?.[i] as
      | { presentation?: { backgroundClass?: string } }
      | undefined;
    const afterBg = afterSection.presentation?.backgroundClass?.trim();
    const beforeBg = beforeSection?.presentation?.backgroundClass?.trim();
    if (afterBg && afterBg !== beforeBg) {
      slots.push({
        kind: 'color',
        phrase_aliases: inferAliasesFromMessage(editContext.ownerMessage, 'color'),
        value: afterBg,
        scope: afterSection.type
          ? { type: 'section_type', sectionType: afterSection.type }
          : { type: 'section_index', sectionIndex: i },
        provenance: {
          turn_id: '',
          user_message_excerpt: editContext.ownerMessage.slice(0, 120),
        },
      });
    }
  }

  return slots;
}

function slotFromPlanStep(
  step: EditStep,
  editContext: EditContext,
  ownerMessage: string,
  turnId: string
): MemorySlotWrite | null {
  const params = step.params ?? {};
  const fieldPath = typeof params.field === 'string' ? params.field : undefined;
  const scope = scopeForTarget(editContext, fieldPath);
  const provenance = {
    turn_id: turnId,
    user_message_excerpt: ownerMessage.slice(0, 120),
  };

  if (step.skill === 'update_section_style') {
    const bg =
      typeof params.backgroundClass === 'string'
        ? params.backgroundClass
        : typeof params.presentation === 'object' &&
            params.presentation &&
            typeof (params.presentation as { backgroundClass?: string }).backgroundClass === 'string'
          ? (params.presentation as { backgroundClass: string }).backgroundClass
          : null;
    const pattern = editPatternFromStep(step);
    if (bg) {
      return {
        kind: 'style_token',
        phrase_aliases: inferAliasesFromMessage(ownerMessage, 'style'),
        value: bg,
        scope,
        provenance,
      };
    }
    if (pattern) {
      return {
        kind: 'edit_pattern',
        phrase_aliases: inferAliasesFromMessage(ownerMessage, 'edit_pattern'),
        value: pattern,
        scope,
        provenance,
      };
    }
    return null;
  }

  if (step.skill === 'update_hero') {
    const value =
      typeof params.value === 'string'
        ? params.value
        : typeof params.headline === 'string'
          ? params.headline
          : typeof params.primaryCta === 'string'
            ? params.primaryCta
            : null;
    if (!value) return null;
    const isCta = typeof params.primaryCta === 'string';
    return {
      kind: isCta ? 'cta' : 'copy',
      phrase_aliases: inferAliasesFromMessage(ownerMessage, isCta ? 'cta' : 'copy'),
      value,
      scope: { type: 'hero' },
      provenance,
    };
  }

  if (
    step.skill === 'update_config_field' ||
    step.skill === 'update_section_copy' ||
    step.skill === 'update_section_item_copy'
  ) {
    const value = typeof params.value === 'string' ? params.value : null;
    if (!value) return null;
    return {
      kind: 'copy',
      phrase_aliases: inferAliasesFromMessage(ownerMessage, 'copy'),
      value,
      scope,
      provenance,
    };
  }

  if (step.skill === 'update_contact') {
    const value =
      typeof params.phone === 'string'
        ? params.phone
        : typeof params.email === 'string'
          ? params.email
          : typeof params.address === 'string'
            ? params.address
            : null;
    if (!value) return null;
    return {
      kind: 'copy',
      phrase_aliases: inferAliasesFromMessage(ownerMessage, 'copy'),
      value,
      scope,
      provenance,
    };
  }

  const pattern = editPatternFromStep(step);
  if (pattern) {
    return {
      kind: 'edit_pattern',
      phrase_aliases: inferAliasesFromMessage(ownerMessage, 'edit_pattern'),
      value: pattern,
      scope,
      provenance,
    };
  }

  return null;
}

export interface DeriveProjectMemorySlotsInput {
  plan: EditPlan;
  editContext: EditContext;
  ownerMessage: string;
  turnId: string;
  beforeFiles?: Record<string, string>;
  afterFiles?: Record<string, string>;
}

/** Derive Monitor memory slots from a successful edit plan and optional file diff. */
export function deriveProjectMemorySlots(input: DeriveProjectMemorySlotsInput): MemorySlotWrite[] {
  if (input.plan.needsClarification || input.plan.steps.length === 0) return [];

  const slots: MemorySlotWrite[] = [];
  const seen = new Set<string>();

  for (const step of input.plan.steps) {
    const slot = slotFromPlanStep(step, input.editContext, input.ownerMessage, input.turnId);
    if (!slot) continue;
    const key = `${slot.kind}:${JSON.stringify(slot.scope)}:${typeof slot.value === 'string' ? slot.value : JSON.stringify(slot.value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push(slot);
  }

  if (input.beforeFiles && input.afterFiles) {
    for (const slot of slotFromStyleDiff(input.editContext, input.beforeFiles, input.afterFiles)) {
      const key = `${slot.kind}:${JSON.stringify(slot.scope)}:${slot.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      slots.push({
        ...slot,
        provenance: {
          turn_id: input.turnId,
          user_message_excerpt: input.ownerMessage.slice(0, 120),
        },
      });
    }
  }

  return slots;
}

export interface DeriveMemoryFromResolvedReferencesInput {
  references?: ImplicitReferenceRecord[] | null;
  editContext: EditContext;
  ownerMessage: string;
  turnId: string;
}

/** Derive memory slots from implicit references resolved during the edit turn. */
export function deriveMemorySlotsFromResolvedReferences(
  input: DeriveMemoryFromResolvedReferencesInput
): MemorySlotWrite[] {
  const references = input.references?.filter((ref) => ref.resolvedValue?.trim()) ?? [];
  if (references.length === 0) return [];

  const slots: MemorySlotWrite[] = [];
  for (const ref of references) {
    const value = ref.resolvedValue!.trim();
    const kind =
      ref.resolvedKind === 'color'
        ? 'color'
        : ref.resolvedKind === 'cta'
          ? 'cta'
          : ref.resolvedKind === 'style'
            ? 'style_token'
            : ref.resolvedKind === 'copy'
              ? 'copy'
              : null;
    if (!kind) continue;

    slots.push({
      kind,
      phrase_aliases: uniqueAliases([ref.phrase, ...inferAliasesFromMessage(input.ownerMessage, kind)]),
      value,
      scope: scopeForTarget(input.editContext),
      provenance: {
        turn_id: input.turnId,
        user_message_excerpt: input.ownerMessage.slice(0, 120),
      },
    });
  }
  return slots;
}
