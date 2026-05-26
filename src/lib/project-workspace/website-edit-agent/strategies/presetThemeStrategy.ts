import {
  extractPresetObjectLiteral,
  parseColorSwap,
  replacePresetInPageContent,
  swapColorsInPresetJson,
  swapTailwindColorInText,
  type PresetScope,
} from '../preset/presetUtils';
import {
  buildStrategyResult,
  GLOBALS_CSS,
  PAGE_TSX,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '../strategyContext';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

function resolveScope(message: string): PresetScope {
  const lower = message.toLowerCase();
  if (/\bhero\b/.test(lower) && !/\b(throughout|everywhere|site|whole)\b/.test(lower)) {
    return 'hero';
  }
  if (/\bbackground\b/.test(lower) && !/\bhero\b/.test(lower)) {
    return 'background';
  }
  return 'site';
}

/**
 * L0: swap Tailwind color tokens in page.tsx preset and globals.css.
 */
export async function runPresetThemeStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (options.mode !== 'gitlab') return null;

  const swap = parseColorSwap(options.ownerMessage);
  if (!swap) return null;

  const pageContent = await readWorkspaceRel(options, PAGE_TSX);
  if (!pageContent) return null;

  const presetJson = extractPresetObjectLiteral(pageContent);
  if (!presetJson) return null;

  const scope = resolveScope(options.ownerMessage);
  const newPresetJson = swapColorsInPresetJson(presetJson, swap.fromColor, swap.toColor, scope);
  let newPage = replacePresetInPageContent(pageContent, newPresetJson);
  if (!newPage) return null;

  newPage = swapTailwindColorInText(newPage, swap.fromColor, swap.toColor);

  await writeWorkspaceRel(options, PAGE_TSX, newPage);

  const globals = await readWorkspaceRel(options, GLOBALS_CSS);
  if (globals) {
    const newGlobals = swapTailwindColorInText(globals, swap.fromColor, swap.toColor);
    if (newGlobals !== globals) {
      await writeWorkspaceRel(options, GLOBALS_CSS, newGlobals);
    }
  }

  return buildStrategyResult(
    options,
    beforeHashes,
    'preset_theme',
    'L0',
    `Changed site colors from ${swap.fromColor} to ${swap.toColor}.`,
    { confidence: 'high' }
  );
}
