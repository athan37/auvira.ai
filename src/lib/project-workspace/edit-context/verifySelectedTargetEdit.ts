import type { EditPlan } from '@/lib/project-workspace/planner/editPlan.schema';
import { mergedStepParams } from '@/lib/project-workspace/planner/editStepParams.schema';
import type { VerificationCheck } from './types';
import type { SelectedTargetContext } from './selectedTargetContext';

/**
 * Build verification checks tied to a UI-pinned selected target context.
 */
export function verifySelectedTargetEdit(input: {
  selectedTargetContext?: SelectedTargetContext;
  planStep: { skill: string; target?: Record<string, unknown>; params?: Record<string, unknown> };
  inferredFieldPath?: string;
}): VerificationCheck[] {
  const { selectedTargetContext, planStep, inferredFieldPath } = input;
  const merged = mergedStepParams(planStep.target, planStep.params);
  const checks: VerificationCheck[] = [];

  if (planStep.skill === 'update_section_style' && selectedTargetContext?.resolved.sectionIndex != null) {
    checks.push({
      kind: 'section_background',
      sectionIndex: selectedTargetContext.resolved.sectionIndex,
      expectedValue:
        (merged.backgroundClass as string | undefined) ??
        (merged.backgroundColor as string | undefined),
    });
    return checks;
  }

  const fieldPath =
    (merged.fieldPath as string | undefined) ??
    inferredFieldPath ??
    selectedTargetContext?.element?.fieldPath ??
    selectedTargetContext?.recommendedDefaultField?.fieldPath;

  const value = merged.value ?? merged[merged.field as string];
  const copySkills = new Set([
    'update_section_copy',
    'update_config_field',
    'update_section_item_copy',
    'update_cta_label',
  ]);

  if (copySkills.has(planStep.skill) && fieldPath && value) {
    checks.push({
      kind: 'copy_field',
      field: fieldPath,
      sectionIndex: selectedTargetContext?.resolved.sectionIndex,
      expectedValue: String(value),
    });
    return checks;
  }

  if (planStep.skill === 'update_hero') {
    const field = (merged.field as string) ?? 'headline';
    const heroValue = merged.value ?? merged[field];
    if (heroValue) {
      checks.push({ kind: 'hero_field', field, expectedValue: String(heroValue) });
    }
  }

  return checks;
}

/** Merge plan verification with selected-target checks. */
export function mergePlanVerificationWithSelectedTarget(
  plan: EditPlan,
  selectedTargetContext?: SelectedTargetContext
): VerificationCheck[] {
  const fromPlan = plan.verification ?? [];
  if (!selectedTargetContext) return fromPlan as VerificationCheck[];

  const extra: VerificationCheck[] = [];
  for (const step of plan.steps) {
    extra.push(
      ...verifySelectedTargetEdit({
        selectedTargetContext,
        planStep: step,
      })
    );
  }

  const seen = new Set<string>();
  const merged: VerificationCheck[] = [];
  for (const check of [...(fromPlan as VerificationCheck[]), ...extra]) {
    const key = `${check.kind}:${check.field ?? ''}:${check.sectionIndex ?? ''}:${check.expectedValue ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(check);
  }
  return merged;
}
