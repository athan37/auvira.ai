import type { EditPlan } from './editPlan.schema';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import { parseConfigFieldPath } from '@/lib/project-workspace/edit-context/configFieldPaths';
import { skillToDomainTool } from '@/lib/project-workspace/tools/domain/registry';
import {
  mergedStepParams,
  SKILL_PARAM_SCHEMAS,
} from './editStepParams.schema';
import type { PlanEditResult } from './planEdit';

const CLARIFY_PARAM =
  'Some edit steps are missing required details. Please specify the exact value, section number, or field to change.';

function clarificationPlan(question: string, suggestedReplies: string[]): EditPlan {
  return {
    planVersion: 'website-agent',
    needsClarification: true,
    clarificationQuestion: question,
    suggestedReplies,
    steps: [],
  };
}

function formatZodIssues(issues: { message: string }[]): string {
  return issues.map((i) => i.message).join('; ');
}

/**
 * Validate plan step params beyond JSON shape — return clarification plan on failure.
 */
export function validateEditPlanSemantics(
  plan: EditPlan,
  editContext: EditContext
): PlanEditResult | null {
  if (plan.needsClarification || plan.steps.length === 0) return null;

  const issues: string[] = [];

  for (const step of plan.steps) {
    if (step.skill === 'custom_code_edit') continue;

    if (!skillToDomainTool(step.skill)) {
      issues.push(`Unsupported skill: ${step.skill}`);
      continue;
    }

    const schema = SKILL_PARAM_SCHEMAS[step.skill];
    if (!schema) continue;

    const merged = mergedStepParams(
      step.target as Record<string, unknown> | undefined,
      step.params as Record<string, unknown> | undefined
    );

    if (
      (step.skill === 'update_section_copy' || step.skill === 'update_section_style' || step.skill === 'remove_section') &&
      merged.sectionIndex == null &&
      editContext.target.sectionIndex != null
    ) {
      merged.sectionIndex = editContext.target.sectionIndex;
    }

    const parsed = schema.safeParse(merged);
    if (!parsed.success) {
      issues.push(`${step.skill}: ${formatZodIssues(parsed.error.issues)}`);
    }

    if (step.skill === 'update_config_field') {
      const fieldPath = String(merged.fieldPath ?? '').trim();
      const value = String(merged.value ?? '').trim();
      if (!fieldPath || !value) {
        issues.push('update_config_field requires canonical fieldPath and value');
      } else if (!parseConfigFieldPath(fieldPath)) {
        issues.push(`update_config_field fieldPath is not allowlisted: ${fieldPath}`);
      }
    }
  }

  const styleSteps = plan.steps.filter((s) => s.skill === 'update_section_style');
  if (styleSteps.length > 1) {
    const indices = new Set(
      styleSteps.map((s) => {
        const m = mergedStepParams(
          s.target as Record<string, unknown> | undefined,
          s.params as Record<string, unknown> | undefined
        );
        return typeof m.sectionIndex === 'number'
          ? m.sectionIndex
          : editContext.target.sectionIndex;
      })
    );
    if (indices.size > 1) {
      issues.push('Multiple section style steps target different sections — clarify which section to style');
    }
  }

  if (issues.length === 0) {
    const sectionStyleOnHeroThread =
      editContext.target.kind === 'hero' &&
      plan.steps.some((step) => step.skill === 'update_section_style') &&
      !plan.steps.some((step) => step.skill === 'update_theme');

    if (sectionStyleOnHeroThread) {
      return {
        ok: true,
        plan: clarificationPlan(
          'This edit thread is about the hero background — I will apply a hero theme change, not a content section background. Please confirm the gradient or color again.',
          ['Blue to green gradient on hero', 'Solid color on hero background', 'Hero at the top — entire background'],
        ),
      };
    }
    return null;
  }

  const question =
    issues.length === 1
      ? `I need one more detail before applying this edit: ${issues[0]}`
      : `${CLARIFY_PARAM} (${issues.slice(0, 3).join(' · ')})`;

  return {
    ok: true,
    plan: clarificationPlan(question, [
      'Specify the section number (e.g. section 2)',
      'Paste the exact new text or color',
      'Say which field to update (headline, phone, business name)',
    ]),
  };
}

/** Apply semantic guard to a parsed plan. */
export function guardEditPlanSemantics(plan: EditPlan, editContext: EditContext): EditPlan {
  const blocked = validateEditPlanSemantics(plan, editContext);
  return blocked?.plan ?? plan;
}
