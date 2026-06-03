import type { WebsitePlan } from '@/lib/agent/schemas';
import { normalizeTemplateSelection } from '@/lib/builder/normalizeTemplateVariant';
import { OWNER_TEMPLATE_REASON } from '@/lib/builder/ownerTemplateSelection';

/** Apply owner-selected color theme onto a website plan's suggestedTemplate. */
export function applyThemeToPlan(
  plan: WebsitePlan,
  category: string,
  variant: string,
  ownerSelected = true
): WebsitePlan {
  const normalized = normalizeTemplateSelection(category, variant);
  const existing = plan.suggestedTemplate ?? {
    category: 'general-service',
    variant: 'modern-clean',
    reason: '',
  };

  return {
    ...plan,
    suggestedTemplate: {
      ...existing,
      category: normalized.category,
      variant: normalized.variant,
      reason: ownerSelected ? OWNER_TEMPLATE_REASON : existing.reason || 'Theme applied.',
    },
  };
}
