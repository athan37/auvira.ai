import { hasExplicitEditTarget } from '../enrichEditPrompt';
import {
  buildStrategyResult,
  readWorkspaceRel,
  SITE_CONFIG,
  writeWorkspaceRel,
} from '../strategyContext';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

/** Extract new value from "to X", to: X, or quoted strings. */
export function extractExplicitTargetValue(message: string): string | null {
  const quoted = message.match(/["']([^"']{2,200})["']/);
  if (quoted?.[1]?.trim()) return quoted[1].trim();

  const toColon = message.match(/\bto\s*:\s*(.+)$/i);
  if (toColon?.[1]?.trim()) return toColon[1].trim();

  const toPlain = message.match(/\bto\s+([A-Za-z0-9][\w\s,'.&-]{2,200})$/i);
  if (toPlain?.[1]?.trim()) return toPlain[1].trim();

  const setAs = message.match(/\b(?:set|make|update)\s+.+\s+(?:to|as)\s+(.+)$/i);
  if (setAs?.[1]?.trim()) return setAs[1].trim();

  return null;
}

function escapeForTsString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * L0: patch hero headline / tagline / subheadline in siteConfig.ts.
 */
export async function runCopyFieldStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (options.mode !== 'gitlab' || !hasExplicitEditTarget(options.ownerMessage)) {
    return null;
  }

  const newValue = extractExplicitTargetValue(options.ownerMessage);
  if (!newValue) return null;

  const content = await readWorkspaceRel(options, SITE_CONFIG);
  if (!content) return null;

  const lower = options.ownerMessage.toLowerCase();
  let updated = content;
  const escaped = escapeForTsString(newValue);

  if (/\bheadline\b/.test(lower) || /\bhero\b/.test(lower)) {
    updated = updated.replace(
      /(headline\s*:\s*)(['"])([^'"]*)\2/,
      `$1'${escaped}'`
    );
  } else if (/\btagline\b/.test(lower)) {
    updated = updated.replace(/(tagline\s*:\s*)(['"])([^'"]*)\2/, `$1'${escaped}'`);
  } else if (/\bsubheadline\b/.test(lower)) {
    updated = updated.replace(
      /(subheadline\s*:\s*)(['"])([^'"]*)\2/,
      `$1'${escaped}'`
    );
  } else {
    updated = updated.replace(
      /(headline\s*:\s*)(['"])([^'"]*)\2/,
      `$1'${escaped}'`
    );
  }

  if (updated === content) return null;

  await writeWorkspaceRel(options, SITE_CONFIG, updated);

  return buildStrategyResult(
    options,
    beforeHashes,
    'copy_field',
    'L0',
    `Updated text to "${newValue}".`,
    { confidence: 'high' }
  );
}
