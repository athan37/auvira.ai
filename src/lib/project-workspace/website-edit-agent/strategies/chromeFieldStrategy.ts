import { extractExplicitTargetValue } from './copyFieldStrategy';
import {
  buildStrategyResult,
  readWorkspaceRel,
  SITE_CONFIG,
  writeWorkspaceRel,
} from '../strategyContext';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

/**
 * L0: update nav labels, CTA text, or footer strings in siteConfig.
 */
export async function runChromeFieldStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (options.mode !== 'gitlab') return null;

  const value = extractExplicitTargetValue(options.ownerMessage);
  if (!value) return null;

  const content = await readWorkspaceRel(options, SITE_CONFIG);
  if (!content) return null;

  const lower = options.ownerMessage.toLowerCase();
  const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  let updated = content;
  let field: string | null = null;

  if (/\bcta\b/.test(lower) || /\bbutton\b/.test(lower)) {
    field = 'primaryCta';
    updated = content.replace(
      /(primaryCta\s*:\s*)(['"])([^'"]*)\2/,
      `$1'${escaped}'`
    );
  } else if (/\bfooter\b/.test(lower) || /\bcopyright\b/.test(lower)) {
    if (!/footerText\s*:/.test(content)) return null;
    updated = content.replace(
      /(footerText\s*:\s*)(['"])([^'"]*)\2/,
      `$1'${escaped}'`
    );
    field = 'footerText';
  } else if (/\bnav\b/.test(lower) || /\bmenu\b/.test(lower)) {
    updated = content.replace(/(businessName\s*:\s*)(['"])([^'"]*)\2/, `$1'${escaped}'`);
    field = 'businessName';
  }

  if (!field || updated === content) return null;

  await writeWorkspaceRel(options, SITE_CONFIG, updated);

  return buildStrategyResult(
    options,
    beforeHashes,
    'chrome_field',
    'L0',
    `Updated ${field} to "${value}".`,
    { confidence: 'high' }
  );
}
