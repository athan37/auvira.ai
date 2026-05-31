import { routeAttachmentEdits } from './attachmentRouter';
import { runGalleryItemDescriptionStrategy } from './galleryItemDescriptionStrategy';
import { runPresetThemeStrategy } from './strategies/presetThemeStrategy';
import type { EditStrategyId, WebsiteEditAgentOptions, WebsiteEditAgentResult } from './types';

type StrategyRunner = (
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
) => Promise<WebsiteEditAgentResult | null>;

const RUNNERS: Partial<Record<EditStrategyId, StrategyRunner>> = {
  preset_theme: runPresetThemeStrategy,
};

/**
 * Run a single strategy by id; returns null if strategy does not apply.
 */
export async function runStrategyById(
  strategyId: EditStrategyId,
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (strategyId === 'image_gallery' || strategyId === 'hero_image') {
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
    tier: result.tier ?? 'L0',
    verifyProfile: result.verifyProfile,
  };
}
