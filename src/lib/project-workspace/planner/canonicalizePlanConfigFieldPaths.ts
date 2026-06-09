import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import { canonicalizeConfigFieldPath } from '@/lib/project-workspace/edit-context/configFieldPaths';
import type { EditPlan } from './editPlan.schema';
import { mergedStepParams } from './editStepParams.schema';

function coerceSectionIndex(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Rewrite planner steps that use bare field names into canonical siteConfig paths.
 */
export function canonicalizePlanConfigFieldPaths(
  plan: EditPlan,
  editContext: EditContext
): EditPlan {
  if (plan.needsClarification || plan.steps.length === 0) return plan;

  const steps = plan.steps.map((step) => {
    if (step.skill !== 'update_config_field') return step;

    const merged = mergedStepParams(
      step.target as Record<string, unknown> | undefined,
      step.params as Record<string, unknown> | undefined
    );

    const sectionIndex = coerceSectionIndex(merged.sectionIndex);
    let rawPath = String(merged.fieldPath ?? '').trim();

    if (!rawPath && merged.field) {
      const field = String(merged.field).trim();
      if (sectionIndex != null && !field.includes('.')) {
        rawPath = `sections[${sectionIndex}].${field}`;
      } else {
        rawPath = field;
      }
    }

    const canonical = canonicalizeConfigFieldPath(rawPath, editContext, sectionIndex);
    if (!canonical) return step;

    return {
      ...step,
      params: {
        ...(step.params ?? {}),
        fieldPath: canonical,
        value: String(merged.value ?? (step.params as Record<string, unknown>)?.value ?? '').trim(),
      },
    };
  });

  return { ...plan, steps };
}
