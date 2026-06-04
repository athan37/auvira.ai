import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import type { EditPlan } from '@/lib/project-workspace/planner/editPlan.schema';
import {
  resolveConfigTextEdit,
  type ConfigTextEditApply,
  fieldPathFromPlanStep,
  valueFromPlanStep,
} from '@/lib/project-workspace/edit-context/resolveConfigTextEdit';
import { parseConfigFieldPath } from '@/lib/project-workspace/edit-context/configFieldPaths';

/** Build a deterministic copy plan from unified resolver output. */
export function planFromConfigTextEdit(editContext: EditContext): EditPlan | null {
  const siteConfigContent = editContext.siteModel.siteConfigContent ?? '';
  const result = resolveConfigTextEdit({
    message: editContext.effectiveMessage,
    siteConfigContent,
    pinnedSectionIndex: editContext.target.sectionIndex,
    selectedTargetContext: editContext.selectedTargetContext,
  });

  if (result.kind === 'none') return null;

  if (result.kind === 'clarify') {
    return {
      planVersion: 'website-agent',
      needsClarification: true,
      clarificationQuestion: result.message,
      suggestedReplies: result.suggestedReplies,
      intent: 'clarification',
      steps: [],
      risk: { level: editContext.riskFlags.level, reasons: editContext.riskFlags.reasons },
    };
  }

  return buildApplyPlan(editContext, result);
}

function buildApplyPlan(editContext: EditContext, apply: ConfigTextEditApply): EditPlan {
  const parsed = parseConfigFieldPath(apply.fieldPath);
  const sectionIndex =
    parsed?.sectionIndex ?? editContext.target.sectionIndex ?? undefined;

  const targets =
    parsed?.scope === 'hero'
      ? [{ kind: 'hero' as const, field: apply.fieldPath }]
      : parsed?.scope === 'businessName'
        ? [{ kind: 'businessName' as const, field: 'businessName' }]
        : sectionIndex != null
          ? [
              {
                kind: 'section' as const,
                sectionIndex,
                sectionTitle: editContext.target.title,
                sectionType: editContext.target.sectionType,
                field: apply.fieldPath,
              },
            ]
          : undefined;

  return {
    planVersion: 'website-agent',
    needsClarification: false,
    intent: 'copy',
    targets,
    verification: [
      {
        kind: 'copy_field',
        field: apply.fieldPath,
        sectionIndex,
        expectedValue: apply.value,
      },
    ],
    risk: { level: editContext.riskFlags.level, reasons: editContext.riskFlags.reasons },
    steps: [
      {
        skill: 'update_config_field',
        params: { fieldPath: apply.fieldPath, value: apply.value },
      },
    ],
  };
}

/**
 * Rewrite LLM misrouted copy plans when unified resolver knows the correct fieldPath.
 */
export function normalizeMisroutedCopyPlan(plan: EditPlan, editContext: EditContext): EditPlan {
  if (plan.needsClarification || plan.steps.length !== 1) return plan;

  const step = plan.steps[0];
  const copySkills = new Set([
    'update_contact',
    'update_hero',
    'update_business_name',
    'update_section_copy',
    'update_config_field',
    'update_section_item_copy',
    'update_cta_label',
  ]);
  if (!step || !copySkills.has(step.skill)) return plan;

  const resolved = resolveConfigTextEdit({
    message: editContext.effectiveMessage,
    siteConfigContent: editContext.siteModel.siteConfigContent ?? '',
    pinnedSectionIndex: editContext.target.sectionIndex,
    selectedTargetContext: editContext.selectedTargetContext,
  });

  if (resolved.kind !== 'apply') return plan;
  if (resolved.mode === 'typed_field' && step.skill === 'update_contact') return plan;
  if (resolved.fieldPath.startsWith('contact.') && step.skill === 'update_contact') return plan;

  const mergedParams = { ...(step.params ?? {}), ...(step.target ?? {}) };
  const currentFieldPath = fieldPathFromPlanStep(
    step.skill,
    mergedParams,
    editContext.effectiveMessage
  );
  if (
    step.skill === 'update_config_field' &&
    currentFieldPath &&
    currentFieldPath === resolved.fieldPath &&
    valueFromPlanStep(step.skill, mergedParams, currentFieldPath) === resolved.value
  ) {
    return plan;
  }

  return buildApplyPlan(editContext, resolved);
}
