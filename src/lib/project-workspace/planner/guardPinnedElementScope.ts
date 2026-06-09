import type { EditPlan } from './editPlan.schema';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import { messageExplicitlyRequestsContactField } from '@/lib/project-workspace/edit-context/configTextEditUtils';
import { fieldPathFromPlanStep } from '@/lib/project-workspace/edit-context/resolveConfigTextEdit';
import { mergedStepParams } from './editStepParams.schema';
import type { PlanEditResult } from './planEdit';

const COPY_SKILLS = new Set([
  'update_config_field',
  'update_section_copy',
  'update_section_item_copy',
  'update_hero',
  'update_contact',
  'update_cta_label',
  'update_business_name',
]);

function clarificationPlan(question: string): EditPlan {
  return {
    planVersion: 'website-agent',
    needsClarification: true,
    clarificationQuestion: question,
    suggestedReplies: [
      'Update the pinned element only',
      'Clear the pin and edit another field',
    ],
    steps: [],
  };
}

/**
 * Reject copy steps that target a field outside the UI-pinned element scope.
 */
export function guardPinnedElementScope(
  plan: EditPlan,
  editContext: EditContext
): PlanEditResult | null {
  const ctx = editContext.selectedTargetContext;
  if (!ctx?.pinnedElementOnly || !ctx.allowedFieldPaths?.length) return null;
  if (plan.needsClarification || plan.steps.length === 0) return null;

  const allowed = new Set(ctx.allowedFieldPaths);

  for (const step of plan.steps) {
    if (!COPY_SKILLS.has(step.skill)) continue;

    const merged = mergedStepParams(
      step.target as Record<string, unknown> | undefined,
      step.params as Record<string, unknown> | undefined
    );
    const fieldPath = fieldPathFromPlanStep(step.skill, merged, editContext.effectiveMessage);
    if (fieldPath && !allowed.has(fieldPath)) {
      if (messageExplicitlyRequestsContactField(editContext.effectiveMessage, fieldPath)) {
        continue;
      }
      const pinned = ctx.allowedFieldPaths[0]!;
      return {
        ok: true,
        plan: clarificationPlan(
          `You pinned \`${pinned}\`. I can only change that field unless you name another target or clear the pin.`
        ),
      };
    }
  }

  return null;
}

/** Apply pinned-element scope guard to a parsed plan. */
export function applyPinnedElementScopeGuard(plan: EditPlan, editContext: EditContext): EditPlan {
  const blocked = guardPinnedElementScope(plan, editContext);
  return blocked?.plan ?? plan;
}
