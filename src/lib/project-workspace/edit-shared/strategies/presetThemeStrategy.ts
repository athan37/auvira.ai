import {
  extractPresetObjectLiteral,
  extractColorsFromMessage,
  parseColorSwap,
  replacePresetInPageContent,
  setPresetCardBackground,
  setPresetHeroBackground,
  swapColorsInPresetJson,
  swapTailwindColorInText,
  type PresetScope,
} from '../preset/presetUtils';
import { extractSectionBackgroundClassFromMessage } from '@/lib/builder/sectionPresentation';
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
  if (
    (/\btestimonial|\bcustomers say|\ball testimonial\b/.test(lower) ||
      /\bcard background/.test(lower)) &&
    /\bcard\b/.test(lower)
  ) {
    return 'testimonialsCard';
  }
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

  const scope = resolveScope(options.ownerMessage);
  const swap = parseColorSwap(options.ownerMessage);
  const targetColors = extractColorsFromMessage(options.ownerMessage);

  const pageContent = await readWorkspaceRel(options, PAGE_TSX);
  if (!pageContent) return null;

  const presetJson = extractPresetObjectLiteral(pageContent);
  if (!presetJson) return null;

  let newPresetJson: string | null = null;
  let summary: string;

  if (scope === 'testimonialsCard' && targetColors.length > 0 && !swap) {
    const toColor = targetColors[targetColors.length - 1];
    newPresetJson = setPresetCardBackground(presetJson, toColor);
    summary = `Changed testimonial card backgrounds to ${toColor}.`;
  } else if (scope === 'hero') {
    const bgClass = extractSectionBackgroundClassFromMessage(options.ownerMessage);
    if (bgClass) {
      newPresetJson = setPresetHeroBackground(presetJson, bgClass);
      summary = 'Updated hero background.';
    } else if (swap) {
      newPresetJson = swapColorsInPresetJson(presetJson, swap.fromColor, swap.toColor, scope);
      summary = `Changed hero colors from ${swap.fromColor} to ${swap.toColor}.`;
    } else {
      return null;
    }
  } else if (swap) {
    newPresetJson = swapColorsInPresetJson(presetJson, swap.fromColor, swap.toColor, scope);
    summary = `Changed site colors from ${swap.fromColor} to ${swap.toColor}.`;
  } else {
    return null;
  }

  let newPage = replacePresetInPageContent(pageContent, newPresetJson);
  if (!newPage) return null;

  if (swap) {
    newPage = swapTailwindColorInText(newPage, swap.fromColor, swap.toColor);
  }

  await writeWorkspaceRel(options, PAGE_TSX, newPage);

  if (swap && scope !== 'testimonialsCard') {
    const globals = await readWorkspaceRel(options, GLOBALS_CSS);
    if (globals) {
      const newGlobals = swapTailwindColorInText(globals, swap.fromColor, swap.toColor);
      if (newGlobals !== globals) {
        await writeWorkspaceRel(options, GLOBALS_CSS, newGlobals);
      }
    }
  }

  return buildStrategyResult(
    options,
    beforeHashes,
    'preset_theme',
    'L0',
    summary,
    { confidence: 'high' }
  );
}
