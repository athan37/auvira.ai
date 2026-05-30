import { resolveGradientBackgroundClass } from '@/lib/builder/sectionPresentation';
import {
  buildSiteSectionCatalog,
  matchSectionFromMessage,
} from '../website-edit-agent/siteSectionCatalog';
import { isGradientBackgroundRequest } from '../website-edit-agent/preset/presetUtils';
import { PAGE_TSX, SITE_CONFIG } from '../website-edit-agent/strategyContext';
import type { WebsiteEditAgentOptions } from '../website-edit-agent/types';
import type { EditPlan } from './editPlanSchema';
import { resolveSectionIndexFromMessage } from './normalizeSectionStyleStep';
import type { SiteModel } from './siteModel';

/**
 * Rule-based V2 plan for generic "color gradient" section backgrounds (no LLM).
 */
export function buildDeterministicGradientPlan(
  options: WebsiteEditAgentOptions,
  siteModel: SiteModel
): EditPlan | null {
  if (!isGradientBackgroundRequest(options.ownerMessage)) {
    return null;
  }

  const siteConfig = siteModel.files.find((f) => f.path === SITE_CONFIG)?.content ?? '';
  const page = siteModel.files.find((f) => f.path === PAGE_TSX)?.content ?? '';
  if (!siteConfig) return null;

  const catalog = buildSiteSectionCatalog(siteConfig, page);
  const match = matchSectionFromMessage(options.ownerMessage, catalog, {
    history: options.conversationHistory,
  });

  let sectionIndex = match?.sectionIndex ?? null;
  if (match?.confidence === 'low' && match.clarificationMessage) {
    return null;
  }
  if (sectionIndex == null) {
    sectionIndex = resolveSectionIndexFromMessage(options.ownerMessage, siteModel.sections);
  }
  if (sectionIndex == null) return null;

  const gradientClass = resolveGradientBackgroundClass(options.ownerMessage);

  return {
    planVersion: 'website-agent-v2',
    intent: 'style',
    route: 'sections',
    confidence: 'high',
    needsClarification: false,
    steps: [
      {
        skill: 'update_section_style',
        args: {
          sectionIndex,
          presentation: { backgroundClass: gradientClass },
        },
      },
    ],
  };
}
