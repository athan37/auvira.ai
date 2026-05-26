import {
  buildStrategyResult,
  readWorkspaceRel,
  SITE_CONFIG,
  writeWorkspaceRel,
} from '../strategyContext';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

function parseReorder(message: string): { type: string; up: boolean } | null {
  const lower = message.toLowerCase();
  if (!/\b(move|reorder|above|below|before|after)\b/.test(lower)) return null;
  for (const type of ['faq', 'testimonials', 'gallery', 'services', 'contact', 'about']) {
    if (new RegExp(`\\b${type}\\b`, 'i').test(lower)) {
      const up = /\b(up|above|before)\b/.test(lower);
      return { type: type === 'testimonial' ? 'testimonials' : type, up };
    }
  }
  return null;
}

/**
 * L0: move a section up or down in siteConfig.sections.
 */
export async function runSectionReorderStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (options.mode !== 'gitlab') return null;

  const spec = parseReorder(options.ownerMessage);
  if (!spec) return null;

  const content = await readWorkspaceRel(options, SITE_CONFIG);
  if (!content) return null;

  const blocks = [...content.matchAll(/\{\s*type\s*:\s*['"]([^'"]+)['"][^}]*\}/gs)].map(
    (m) => m[0]
  );
  const types = [...content.matchAll(/\{\s*type\s*:\s*['"]([^'"]+)['"]/g)].map((m) =>
    m[1].toLowerCase()
  );

  const idx = types.indexOf(spec.type);
  if (idx < 0) return null;

  const swapIdx = spec.up ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= blocks.length) return null;

  const reordered = [...blocks];
  [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

  const updated = content.replace(
    /sections\s*:\s*\[[\s\S]*?\]/,
    `sections: [\n    ${reordered.join(',\n    ')}\n  ]`
  );

  if (updated === content) return null;

  await writeWorkspaceRel(options, SITE_CONFIG, updated);

  return buildStrategyResult(
    options,
    beforeHashes,
    'section_reorder',
    'L0',
    `Moved the ${spec.type} section ${spec.up ? 'up' : 'down'}.`,
    { confidence: 'high' }
  );
}
