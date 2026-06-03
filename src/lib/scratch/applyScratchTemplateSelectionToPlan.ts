import type { WebsitePlan } from '@/lib/agent/schemas';
import { applyLayoutStarterToPlan } from '@/lib/scratch/applyLayoutStarterToPlan';
import { applyThemeToPlan } from '@/lib/scratch/applyThemeToPlan';

export interface ScratchTemplateSelection {
  layoutStarterId?: string;
  templateCategory?: string;
  templateVariant?: string;
}

/** Apply independent layout starter and color theme selections to a website plan. */
export function applyScratchTemplateSelectionToPlan(
  plan: WebsitePlan,
  selection: ScratchTemplateSelection
): WebsitePlan {
  let next = applyLayoutStarterToPlan(plan, selection.layoutStarterId);

  if (selection.templateCategory && selection.templateVariant) {
    next = applyThemeToPlan(next, selection.templateCategory, selection.templateVariant, true);
  }

  return next;
}
