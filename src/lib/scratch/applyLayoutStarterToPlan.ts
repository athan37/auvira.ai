import type { WebsitePlan } from '@/lib/agent/schemas';
import { getDefaultLayoutStarter, getLayoutStarter } from '@/lib/builder/layoutStarters';

/** Apply owner-selected layout starter onto a website plan's suggestedTemplate. */
export function applyLayoutStarterToPlan(plan: WebsitePlan, layoutStarterId?: string): WebsitePlan {
  const starter = getLayoutStarter(layoutStarterId) ?? getDefaultLayoutStarter();
  return {
    ...plan,
    suggestedTemplate: {
      category: starter.category,
      variant: starter.variant,
      reason: layoutStarterId ? 'Selected by owner' : 'Default layout starter applied.',
      layoutStarterId: starter.id,
    },
  };
}
