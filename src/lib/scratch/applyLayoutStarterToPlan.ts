import type { WebsitePlan } from '@/lib/agent/schemas';
import { getDefaultLayoutStarter, getLayoutStarter } from '@/lib/builder/layoutStarters';

/** Apply owner-selected layout starter onto a website plan (structure only; color theme stays separate). */
export function applyLayoutStarterToPlan(plan: WebsitePlan, layoutStarterId?: string): WebsitePlan {
  const starter = getLayoutStarter(layoutStarterId) ?? getDefaultLayoutStarter();
  const existing = plan.suggestedTemplate ?? {
    category: 'general-service',
    variant: 'modern-clean',
    reason: '',
  };

  return {
    ...plan,
    suggestedTemplate: {
      ...existing,
      layoutStarterId: starter.id,
    },
  };
}
