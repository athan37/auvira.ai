import type { EditSkillName } from './editPlan.schema';

const SKILL_ALIASES: Record<string, EditSkillName> = {
  update_copy: 'update_section_copy',
  update_section_text: 'update_section_copy',
  update_section: 'update_section_copy',
  change_section_copy: 'update_section_copy',
  update_business: 'update_business_name',
  change_business_name: 'update_business_name',
  update_style: 'update_section_style',
  section_style: 'update_section_style',
  remove: 'remove_section',
  delete_section: 'remove_section',
  reorder: 'reorder_sections',
};

function coerceNumericFields(obj: Record<string, unknown>, keys: string[]): void {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      obj[key] = Number(value);
    }
  }
}

function normalizeStep(step: Record<string, unknown>): Record<string, unknown> {
  const next = { ...step };
  const rawSkill = String(next.skill ?? '');
  if (SKILL_ALIASES[rawSkill]) {
    next.skill = SKILL_ALIASES[rawSkill];
  }

  if (next.target && typeof next.target === 'object') {
    coerceNumericFields(next.target as Record<string, unknown>, ['sectionIndex', 'fromIndex', 'toIndex']);
  }
  if (next.params && typeof next.params === 'object') {
    coerceNumericFields(next.params as Record<string, unknown>, [
      'sectionIndex',
      'fromIndex',
      'toIndex',
    ]);
  }
  return next;
}

/** Normalize planner JSON before Zod validation (LLM alias cleanup). */
export function normalizeEditPlanPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;

  const plan = { ...(raw as Record<string, unknown>) };

  if (
    !plan.clarificationQuestion &&
    typeof plan.clarificationMessage === 'string' &&
    plan.clarificationMessage.trim()
  ) {
    plan.clarificationQuestion = plan.clarificationMessage;
    delete plan.clarificationMessage;
  }

  const targets = plan.targets;
  if (Array.isArray(targets)) {
    plan.targets = targets.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      const target = { ...(entry as Record<string, unknown>) };
      if (target.kind === 'business' || target.kind === 'business-name') {
        target.kind = 'businessName';
      }
      coerceNumericFields(target, ['sectionIndex']);
      return target;
    });
  }

  if (Array.isArray(plan.steps)) {
    plan.steps = plan.steps.map((step) =>
      step && typeof step === 'object' ? normalizeStep(step as Record<string, unknown>) : step
    );
  }

  if (Array.isArray(plan.verification)) {
    plan.verification = plan.verification.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      const spec = { ...(entry as Record<string, unknown>) };
      coerceNumericFields(spec, ['sectionIndex']);
      return spec;
    });
  }

  return plan;
}
