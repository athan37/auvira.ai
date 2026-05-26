import { extractExplicitTargetValue } from './copyFieldStrategy';
import {
  buildStrategyResult,
  readWorkspaceRel,
  STATIC_INDEX,
  STATIC_SITE_JSON,
  writeWorkspaceRel,
} from '../strategyContext';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

/**
 * L0: update headline/title in static site.json or index.html.
 */
export async function runStaticCopyStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (options.mode !== 'static') return null;

  const newValue = extractExplicitTargetValue(options.ownerMessage);
  if (!newValue) return null;

  const json = await readWorkspaceRel(options, STATIC_SITE_JSON);
  if (json) {
    const escaped = newValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    let updated = json;
    if (/"(headline|title)"\s*:/.test(json)) {
      updated = json.replace(/"(headline|title)"\s*:\s*"[^"]*"/, (_m, key) => `"${key}": "${escaped}"`);
    } else {
      updated = json.replace(/\{/, `{\n  "headline": "${escaped}",`);
    }
    if (updated !== json) {
      await writeWorkspaceRel(options, STATIC_SITE_JSON, updated);
      return buildStrategyResult(
        options,
        beforeHashes,
        'static_copy',
        'L0',
        `Updated text to "${newValue}".`,
        { confidence: 'high' }
      );
    }
  }

  const html = await readWorkspaceRel(options, STATIC_INDEX);
  if (html && /<h1[^>]*>/.test(html)) {
    const updated = html.replace(/(<h1[^>]*>)[^<]*(<\/h1>)/i, `$1${newValue}$2`);
    if (updated !== html) {
      await writeWorkspaceRel(options, STATIC_INDEX, updated);
      return buildStrategyResult(
        options,
        beforeHashes,
        'static_copy',
        'L0',
        `Updated headline to "${newValue}".`,
        { confidence: 'high' }
      );
    }
  }

  return null;
}
