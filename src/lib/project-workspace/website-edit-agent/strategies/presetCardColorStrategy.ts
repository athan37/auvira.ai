import {
  extractColorsFromMessage,
  extractPresetObjectLiteral,
  replacePresetInPageContent,
  swapTailwindColorInText,
} from '../preset/presetUtils';
import {
  tryResolveScopedStyleFromHistory,
  type ConversationTurn,
} from '../editAmbiguity';
import {
  buildStrategyResult,
  PAGE_TSX,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '../strategyContext';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

const CARD_PRESET_KEY = 'card';

function targetColorFromMessage(
  message: string,
  history?: ConversationTurn[]
): string | null {
  const colors = extractColorsFromMessage(message);
  if (colors.length > 0) return colors[colors.length - 1];

  if (history?.length) {
    const resolved = tryResolveScopedStyleFromHistory(message, history);
    if (resolved.targetColor) return resolved.targetColor;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') {
        const prior = extractColorsFromMessage(history[i].content);
        if (prior.length > 0) return prior[prior.length - 1];
      }
    }
  }

  const toMatch = message.toLowerCase().match(/\bto\s+(\w+)\b/);
  if (toMatch && colors.length === 0) {
    const c = toMatch[1];
    if (/^(red|blue|green|yellow|orange|purple|pink|black|white|teal|cyan|indigo|gray|grey)$/i.test(c)) {
      return c.toLowerCase();
    }
  }

  return extractColorsFromMessage(message).pop() ?? null;
}

/** Set preset.card to a Tailwind border/background class for testimonial cards. */
function setPresetCardColor(presetJson: string, toColor: string): string {
  const cardClass = `border-${toColor}-200 bg-${toColor}-50`;
  const re = new RegExp(`("${CARD_PRESET_KEY}"\\s*:\\s*")([^"]*)(")`, 'i');
  if (re.test(presetJson)) {
    return presetJson.replace(re, `$1${cardClass}$3`);
  }
  const insert = `"${CARD_PRESET_KEY}": "${cardClass}",\n  `;
  return presetJson.replace(/^\{\s*/, `{ ${insert}`);
}

/**
 * L0: scoped testimonial/card background via preset.card in page.tsx (never siteConfig).
 */
export async function runPresetCardColorStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (options.mode !== 'gitlab') return null;

  const history = options.conversationHistory ?? [];
  const resolved = tryResolveScopedStyleFromHistory(options.ownerMessage, history);
  const lower = options.ownerMessage.toLowerCase();

  const wantsCardScope =
    (resolved.resolved && resolved.scope === 'allTestimonialCards') ||
    (/\b(card|testimonial|customers say)\b/i.test(lower) &&
      /\b(red|blue|green|yellow|orange|purple|pink|black|white)\b/i.test(lower) &&
      !/\b(headline|hero)\b/i.test(lower));

  if (!wantsCardScope && !resolved.resolved) {
    return null;
  }

  if (resolved.resolved && resolved.scope === 'sectionTextColor') {
    return null;
  }

  if (resolved.resolved && resolved.scope === 'oneTestimonialCard') {
    return null;
  }

  const toColor = targetColorFromMessage(options.ownerMessage, history);
  if (!toColor) return null;

  const pageContent = await readWorkspaceRel(options, PAGE_TSX);
  if (!pageContent) return null;

  const presetJson = extractPresetObjectLiteral(pageContent);
  if (!presetJson) return null;

  const existingCard = presetJson.match(/"card"\s*:\s*"([^"]*)"/i)?.[1] ?? '';
  let newPresetJson = setPresetCardColor(presetJson, toColor);

  if (existingCard) {
    for (const c of ['slate', 'gray', 'grey', 'white', 'red', 'blue', 'green', 'yellow', 'orange']) {
      if (existingCard.includes(c) && c !== toColor) {
        newPresetJson = swapTailwindColorInText(newPresetJson, c, toColor);
        break;
      }
    }
  }

  const newPage = replacePresetInPageContent(pageContent, newPresetJson);
  if (!newPage) return null;

  await writeWorkspaceRel(options, PAGE_TSX, newPage);

  return buildStrategyResult(
    options,
    beforeHashes,
    'preset_card_color',
    'L0',
    `Updated testimonial card styling to ${toColor}.`,
    { confidence: 'high', verifyProfile: 'color' }
  );
}
