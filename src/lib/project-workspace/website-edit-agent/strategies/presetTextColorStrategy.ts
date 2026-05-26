import { extractColorsFromMessage, isTextColorEditRequest } from '../../verifyPreviewHints';
import {
  extractPresetObjectLiteral,
  replacePresetInPageContent,
  setPresetTextColorKeys,
} from '../preset/presetUtils';
import {
  buildStrategyResult,
  PAGE_TSX,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '../strategyContext';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

/**
 * L0: set preset text color keys (heroText, sectionTitle, etc.) for headline/text color edits.
 */
export async function runPresetTextColorStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (options.mode !== 'gitlab' || !isTextColorEditRequest(options.ownerMessage)) {
    return null;
  }

  const colors = extractColorsFromMessage(options.ownerMessage);
  const toColor = colors[colors.length - 1];
  if (!toColor) return null;

  const pageContent = await readWorkspaceRel(options, PAGE_TSX);
  if (!pageContent) return null;

  const presetJson = extractPresetObjectLiteral(pageContent);
  if (!presetJson) return null;

  const lower = options.ownerMessage.toLowerCase();
  const keys =
    /\bheadline\b/.test(lower) || /\bhero\b/.test(lower)
      ? (['heroText', 'heroMutedText', 'heroEyebrow'] as const)
      : undefined;

  const newPresetJson = setPresetTextColorKeys(presetJson, toColor, keys);
  const newPage = replacePresetInPageContent(pageContent, newPresetJson);
  if (!newPage || newPage === pageContent) return null;

  await writeWorkspaceRel(options, PAGE_TSX, newPage);

  return buildStrategyResult(
    options,
    beforeHashes,
    'preset_text_color',
    'L0',
    `Updated text color to ${toColor}.`,
    { confidence: 'high' }
  );
}
