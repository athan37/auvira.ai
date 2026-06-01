import type { EditPlan } from '@/lib/project-workspace/planner/editPlan.schema';
import type { VerificationCheck, VerificationContract } from './types';
import { mergedStepParams } from '@/lib/project-workspace/planner/editStepParams.schema';

function coerceIndex(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

/**
 * Build hard verification checks from executed plan steps (not only user message).
 */
export function buildVerificationContractFromPlan(plan: EditPlan): VerificationContract {
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
    }

    if (step.skill === 'update_contact') {
      const field =
        (merged.field as string) ??
        (merged.phone ? 'phone' : merged.email ? 'email' : merged.address ? 'address' : 'phone');
      checks.push({
        kind: 'contact_field',
        field,
        expectedValue: String(merged.value ?? merged[field] ?? ''),
      });
    }

    if (step.skill === 'update_hero') {
      const field = (merged.field as string) ?? 'headline';
      const value = merged.value ?? merged[field] ?? merged.headline;
      if (value) {
        checks.push({
          kind: 'hero_field',
          field,
          expectedValue: String(value),
        });
      }
    }

    if (step.skill === 'update_business_name') {
      const value = merged.value ?? merged.businessName;
      if (value) {
        checks.push({
          kind: 'business_name',
          expectedValue: String(value),
        });
      }
    }

    const copySkills = new Set([
      'update_section_copy',
      'update_config_field',
      'update_section_item_copy',
      'update_cta_label',
    ]);
    if (copySkills.has(step.skill)) {
      const fieldPath =
        (merged.fieldPath as string | undefined) ??
        (merged.field === 'title' || merged.field === 'body'
          ? merged.sectionIndex != null
            ? `sections[${merged.sectionIndex}].${merged.field}`
            : undefined
          : undefined);
      const value = merged.value ?? merged[merged.field as string];
      if (fieldPath && value) {
        checks.push({
          kind: 'copy_field',
          field: fieldPath,
          sectionIndex: coerceIndex(merged.sectionIndex),
          expectedValue: String(value),
        });
      }
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
