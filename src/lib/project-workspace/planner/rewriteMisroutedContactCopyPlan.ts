import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import { inferPinnedContactSectionCopy } from '@/lib/project-workspace/edit-context/pinnedContactSectionCopy';
import type { EditPlan } from './editPlan.schema';

/**
 * When the owner pinned a contact section and asked to change "contact information"
 * prose, rewrite mistaken update_contact plans to section copy edits.
 */
export function rewriteMisroutedContactCopyPlan(plan: EditPlan, editContext: EditContext): EditPlan {
  if (plan.needsClarification || plan.steps.length !== 1) return plan;

  const step = plan.steps[0];
  if (step?.skill !== 'update_contact') return plan;

  const ctx = editContext.selectedTargetContext;
  const pinnedCopy = ctx ? inferPinnedContactSectionCopy(editContext.effectiveMessage, ctx) : null;
  if (!pinnedCopy) return plan;

  const sectionIndex = editContext.target.sectionIndex ?? ctx?.resolved.sectionIndex;

  return {
    ...plan,
    intent: 'copy',
    targets: sectionIndex != null
      ? [
          {
            kind: 'section',
            sectionIndex,
            sectionTitle: editContext.target.title ?? ctx?.resolved.sectionTitle,
            sectionType: editContext.target.sectionType ?? ctx?.resolved.sectionType,
            field: pinnedCopy.fieldPath,
          },
        ]
      : plan.targets,
    verification: [
      {
        kind: 'copy_field',
        field: pinnedCopy.fieldPath,
        sectionIndex,
        expectedValue: pinnedCopy.value,
      },
    ],
    steps: [
      {
        skill: 'update_config_field',
        params: {
          fieldPath: pinnedCopy.fieldPath,
          value: pinnedCopy.value,
        },
      },
    ],
  };
}
