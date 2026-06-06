import type { EditPlan } from '@/lib/project-workspace/planner/editPlan.schema';
import type { VerificationCheck, VerificationContract } from './types';
import { mergedStepParams } from '@/lib/project-workspace/planner/editStepParams.schema';
import {
  fieldPathFromPlanStep,
  valueFromPlanStep,
} from './resolveConfigTextEdit';
import { parseConfigFieldPath } from './configFieldPaths';
import type { PresentationStyleField } from './inferPresentationStyleTarget';

function coercePresentationField(value: unknown): PresentationStyleField {
  if (
    value === 'cardClass' ||
    value === 'titleClass' ||
    value === 'bodyClass' ||
    value === 'eyebrowClass'
  ) {
    return value;
  }
  return 'backgroundClass';
}

function coerceIndex(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

const COPY_SKILLS = new Set([
  'update_section_copy',
  'update_config_field',
  'update_section_item_copy',
  'update_cta_label',
  'update_contact',
  'update_hero',
  'update_business_name',
]);

/**
 * Build hard verification checks from executed plan steps (not only user message).
 */
export function buildVerificationContractFromPlan(
  plan: EditPlan,
  message?: string
): VerificationContract {
  const checks: VerificationCheck[] = [];

  for (const step of plan.steps) {
    const merged = mergedStepParams(
      step.target as Record<string, unknown> | undefined,
      step.params as Record<string, unknown> | undefined
    );

    if (step.skill === 'update_section_style') {
      const sectionIndex = coerceIndex(merged.sectionIndex);
      if (sectionIndex != null) {
        const presentationField = coercePresentationField(merged.presentationField);
        const expectedValue =
          (merged.textClass as string | undefined) ??
          (merged.backgroundClass as string | undefined) ??
          (merged.backgroundColor as string | undefined) ??
          (merged.color as string | undefined);
        checks.push({
          kind: 'section_background',
          sectionIndex,
          field: presentationField,
          expectedValue: expectedValue?.trim() || undefined,
        });
      }
      continue;
    }

    if (COPY_SKILLS.has(step.skill)) {
      const fieldPath = fieldPathFromPlanStep(step.skill, merged, message);
      const expectedValue = fieldPath ? valueFromPlanStep(step.skill, merged, fieldPath) : undefined;
      if (fieldPath && expectedValue) {
        const parsed = parseConfigFieldPath(fieldPath);
        checks.push({
          kind: 'copy_field',
          field: fieldPath,
          sectionIndex: parsed?.sectionIndex ?? coerceIndex(merged.sectionIndex),
          expectedValue,
        });
      }
      continue;
    }

    if (
      step.skill === 'add_section_item' ||
      step.skill === 'remove_section_item' ||
      step.skill === 'duplicate_section_item' ||
      step.skill === 'update_section_item'
    ) {
      const sectionIndex = coerceIndex(merged.sectionIndex);
      const itemIndex = coerceIndex(merged.itemIndex ?? merged.cloneFromItemIndex);
      if (sectionIndex == null) continue;

      if (step.skill === 'remove_section_item') {
        checks.push({
          kind: 'section_items',
          sectionIndex,
          operation: 'remove',
          itemIndex,
          expectedLengthDelta: -1,
        });
      } else if (step.skill === 'duplicate_section_item') {
        checks.push({
          kind: 'section_items',
          sectionIndex,
          operation: 'duplicate',
          itemIndex,
          expectedLengthDelta: 1,
          expectedInsertIndex: itemIndex != null ? itemIndex + 1 : undefined,
          field: typeof merged.title === 'string' ? 'title' : undefined,
          expectedValue: typeof merged.title === 'string' ? merged.title : undefined,
        });
      } else if (step.skill === 'add_section_item') {
        checks.push({
          kind: 'section_items',
          sectionIndex,
          operation: 'add',
          itemIndex,
          expectedLengthDelta: 1,
          expectedInsertIndex:
            itemIndex != null && (merged.cloneFromPinned || merged.cloneFromItemIndex != null)
              ? itemIndex + 1
              : undefined,
          field: typeof merged.title === 'string' ? 'title' : undefined,
          expectedValue: typeof merged.title === 'string' ? merged.title : undefined,
        });
      } else if (step.skill === 'update_section_item') {
        const field =
          (typeof merged.field === 'string' && merged.field) ||
          (merged.title ? 'title' : merged.description ? 'description' : undefined);
        const expectedValue =
          (typeof merged.value === 'string' && merged.value) ||
          (typeof merged.title === 'string' && merged.title) ||
          (typeof merged.description === 'string' && merged.description) ||
          undefined;
        checks.push({
          kind: 'section_items',
          sectionIndex,
          operation: 'update',
          itemIndex,
          expectedLengthDelta: 0,
          field,
          expectedValue,
        });
      }
      continue;
    }
  }

  if (checks.length === 0) {
    checks.push({ kind: 'generic' });
  }

  return { checks };
}

/** Merge message-derived checks with plan-derived checks (plan wins on duplicates). */
export function mergeVerificationContracts(
  fromMessage: VerificationContract,
  fromPlan: VerificationContract
): VerificationContract {
  const kinds = new Set(fromPlan.checks.map((c) => c.kind));
  const merged = [...fromPlan.checks];
  for (const check of fromMessage.checks) {
    if (check.kind === 'generic') continue;
    if (!kinds.has(check.kind)) {
      merged.push(check);
      kinds.add(check.kind);
    }
  }
  if (merged.length === 0) {
    merged.push({ kind: 'generic' });
  }
  return { checks: merged };
}
