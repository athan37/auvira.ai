import { routeAttachmentEdits } from './attachmentRouter';
import { runSectionConfigStrategy } from './sectionConfigStrategy';
import { runSingleShotStrategy } from './singleShotStrategy';
import { runGalleryItemDescriptionStrategy } from './galleryItemDescriptionStrategy';
import { runPresetThemeStrategy } from './strategies/presetThemeStrategy';
import { runPresetTextColorStrategy } from './strategies/presetTextColorStrategy';
import { runCopyFieldStrategy } from './strategies/copyFieldStrategy';
import { runContactFieldStrategy } from './strategies/contactFieldStrategy';
import { runSectionRemoveStrategy } from './strategies/sectionRemoveStrategy';
import { runSectionReorderStrategy } from './strategies/sectionReorderStrategy';
import { runStaticThemeStrategy } from './strategies/staticThemeStrategy';
import { runStaticCopyStrategy } from './strategies/staticCopyStrategy';
import { runChromeFieldStrategy } from './strategies/chromeFieldStrategy';
import { runMetaFieldStrategy } from './strategies/metaFieldStrategy';
import { runSectionFaqTemplateStrategy } from './strategies/sectionFaqTemplateStrategy';
import type { EditJobPlan, EditStrategyId, WebsiteEditAgentOptions, WebsiteEditAgentResult } from './types';

type StrategyRunner = (
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
) => Promise<WebsiteEditAgentResult | null>;

const RUNNERS: Partial<Record<EditStrategyId, StrategyRunner>> = {
  preset_theme: runPresetThemeStrategy,
  preset_text_color: runPresetTextColorStrategy,
  copy_field: runCopyFieldStrategy,
  contact_field: runContactFieldStrategy,
  section_remove: runSectionRemoveStrategy,
  section_reorder: runSectionReorderStrategy,
  static_theme: runStaticThemeStrategy,
  static_copy: runStaticCopyStrategy,
  chrome_field: runChromeFieldStrategy,
  meta_field: runMetaFieldStrategy,
  section_faq_template: runSectionFaqTemplateStrategy,
  single_shot: runSingleShotStrategy,
  section_config: runSectionConfigStrategy,
};

/**
 * Run a single strategy by id; returns null if strategy does not apply.
 */
export async function runStrategyById(
  strategyId: EditStrategyId,
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (
    strategyId === 'image_gallery' ||
    strategyId === 'hero_image' ||
    strategyId === 'static_gallery'
  ) {
    return routeAttachmentEdits(options, beforeHashes);
  }

  if (strategyId === 'gallery_captions') {
    return runGalleryItemDescriptionStrategy(options, beforeHashes);
  }

  const runner = RUNNERS[strategyId];
  if (!runner) return null;

  const result = await runner(options, beforeHashes);
  if (!result) return null;

  return {
    ...result,
    strategy: strategyId,
    tier: result.tier ?? (strategyId === 'single_shot' || strategyId === 'section_config' ? 'L2' : 'L0'),
    verifyProfile: result.verifyProfile,
  };
}

/**
 * Try strategies in plan order until one succeeds.
 */
export async function runStrategyPlan(
  plan: EditJobPlan,
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<{ result: WebsiteEditAgentResult | null; attempted: EditStrategyId[]; fallbackFrom?: EditStrategyId }> {
  const attempted: EditStrategyId[] = [];
  let fallbackFrom: EditStrategyId | undefined;

  for (let i = 0; i < plan.tryOrder.length; i++) {
    const strategyId = plan.tryOrder[i];
    if (strategyId === 'agent_loop') continue;

    attempted.push(strategyId);
    const result = await runStrategyById(strategyId, options, beforeHashes);
    if (result?.ok) {
      return {
        result: {
          ...result,
          tier: result.tier ?? plan.tier,
          confidence: result.confidence ?? plan.confidence,
          verifyProfile: result.verifyProfile ?? plan.verifyProfile,
        },
        attempted,
        fallbackFrom: i > 0 ? plan.tryOrder[0] : undefined,
      };
    }
    if (i === 0) fallbackFrom = strategyId;
  }

  return { result: null, attempted, fallbackFrom };
}
