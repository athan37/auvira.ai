import type { EditPlan } from './editPlan.schema';
import { skillToDomainTool } from '@/lib/project-workspace/tools/domain/registry';
import type { PlanEditResult } from './planEdit';

const CLARIFY_UNSUPPORTED =
  'That change is not supported in the automated editor yet. Try rephrasing as a specific copy, color, or section update.';

const CLARIFY_REPLACE_IMAGE =
  'To replace or add images, upload the image in chat and tell me where it should go (hero, gallery, or a section).';

function clarificationPlan(question: string, suggestedReplies: string[]): EditPlan {
  return {
    planVersion: 'website-agent',
    needsClarification: true,
    clarificationQuestion: question,
    suggestedReplies,
    steps: [],
  };
}

/**
 * If the plan uses skills V3 cannot execute, return a clarification result instead of running steps.
 */
export function validatePlanSkills(
  plan: EditPlan,
  options?: { hasAttachments?: boolean }
): PlanEditResult | null {
  if (plan.needsClarification) return null;

  const unsupported = plan.steps
    .map((s) => s.skill)
    .filter((skill) => skill !== 'custom_code_edit' && !skillToDomainTool(skill));

  if (unsupported.length > 0) {
    return {
      ok: true,
      plan: clarificationPlan(CLARIFY_UNSUPPORTED, [
        'Change section text or headline',
        'Change a section background color',
        'Update contact phone or email',
      ]),
    };
  }

  const hasReplaceImage = plan.steps.some((s) => s.skill === 'replace_image');
  if (hasReplaceImage) {
    void options;
    return {
      ok: true,
      plan: clarificationPlan(CLARIFY_REPLACE_IMAGE, [
        'Upload an image and add it to the gallery',
        'Upload an image for the hero section',
        'Describe which section should use the new image',
      ]),
    };
  }

  if (plan.steps.some((s) => s.skill === 'custom_code_edit')) {
    const allowCustom =
      process.env.WEBSITE_EDIT_ALLOW_CUSTOM_CODE === '1' ||
      process.env.WEBSITE_EDIT_ALLOW_CUSTOM_CODE === 'true';
    if (!allowCustom) {
      return {
        ok: true,
        plan: clarificationPlan(CLARIFY_UNSUPPORTED, [
          'Change section text or headline',
          'Change a section background color',
          'Update contact phone or email',
        ]),
      };
    }
  }

  return null;
}

/**
 * Normalize a planner result: unsupported skills or replace_image without uploads become clarification plans.
 */
export function guardUnsupportedPlanSkills(
  plan: EditPlan,
  options?: { hasAttachments?: boolean }
): EditPlan {
  const blocked = validatePlanSkills(plan, options);
  return blocked?.plan ?? plan;
}
