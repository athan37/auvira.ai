import { extractExplicitTargetValue } from './copyFieldStrategy';
import {
  buildStrategyResult,
  LAYOUT_TSX,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '../strategyContext';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

/**
 * L0: patch Next.js layout metadata title/description.
 */
export async function runMetaFieldStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (options.mode !== 'gitlab') return null;

  const value = extractExplicitTargetValue(options.ownerMessage);
  if (!value) return null;

  const layout = await readWorkspaceRel(options, LAYOUT_TSX);
  if (!layout) return null;

  const lower = options.ownerMessage.toLowerCase();
  const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  let updated = layout;

  if (/\bdescription\b/.test(lower)) {
    if (/description\s*:/.test(layout)) {
      updated = layout.replace(/(description\s*:\s*)(['"])([^'"]*)\2/, `$1'${escaped}'`);
    } else if (/metadata\s*=\s*\{/.test(layout)) {
      updated = layout.replace(
        /metadata\s*=\s*\{/,
        `metadata = {\n  description: '${escaped}',`
      );
    }
  } else {
    if (/title\s*:/.test(layout)) {
      updated = layout.replace(/(title\s*:\s*)(['"])([^'"]*)\2/, `$1'${escaped}'`);
    } else if (/metadata\s*=\s*\{/.test(layout)) {
      updated = layout.replace(/metadata\s*=\s*\{/, `metadata = {\n  title: '${escaped}',`);
    }
  }

  if (updated === layout) return null;

  await writeWorkspaceRel(options, LAYOUT_TSX, updated);

  return buildStrategyResult(
    options,
    beforeHashes,
    'meta_field',
    'L0',
    `Updated page metadata.`,
    { confidence: 'high' }
  );
}
