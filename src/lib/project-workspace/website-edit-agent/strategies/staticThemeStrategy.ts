import { parseColorSwap, swapTailwindColorInText } from '../preset/presetUtils';
import {
  buildStrategyResult,
  readWorkspaceRel,
  STATIC_INDEX,
  STATIC_SITE_JSON,
  STATIC_STYLES,
  writeWorkspaceRel,
} from '../strategyContext';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

/**
 * L0: swap color tokens in static index.html, styles.css, and site.json.
 */
export async function runStaticThemeStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (options.mode !== 'static') return null;

  const swap = parseColorSwap(options.ownerMessage);
  if (!swap) return null;

  let wrote = false;
  for (const rel of [STATIC_INDEX, STATIC_STYLES, STATIC_SITE_JSON]) {
    const content = await readWorkspaceRel(options, rel);
    if (!content) continue;
    const next = swapTailwindColorInText(content, swap.fromColor, swap.toColor);
    if (next !== content) {
      await writeWorkspaceRel(options, rel, next);
      wrote = true;
    }
  }

  if (!wrote) return null;

  return buildStrategyResult(
    options,
    beforeHashes,
    'static_theme',
    'L0',
    `Changed colors from ${swap.fromColor} to ${swap.toColor}.`,
    { confidence: 'high' }
  );
}
