import type { EditPlan } from '@/lib/project-workspace/planner/editPlan.schema';
import type { VerificationCheck, VerificationContract } from './types';
import { mergedStepParams } from '@/lib/project-workspace/planner/editStepParams.schema';
import {
  fieldPathFromPlanStep,
  valueFromPlanStep,
} from './resolveConfigTextEdit';
import { parseConfigFieldPath } from './configFieldPaths';

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
        checks.push({
          kind: 'section_background',
          sectionIndex,
          field:
            merged.presentationField === 'cardClass' ? 'cardClass' : 'backgroundClass',
          expectedValue:
            (merged.backgroundClass as string | undefined) ??
            (merged.backgroundColor as string | undefined),
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
