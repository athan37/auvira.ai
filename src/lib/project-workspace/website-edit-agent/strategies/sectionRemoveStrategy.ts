import {
  buildStrategyResult,
  readWorkspaceRel,
  SITE_CONFIG,
  writeWorkspaceRel,
} from '../strategyContext';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

function parseRemoveTarget(message: string): string | null {
  const lower = message.toLowerCase();
  if (!/\b(remove|delete|hide)\b/.test(lower)) return null;
  for (const type of [
    'faq',
    'testimonials',
    'testimonial',
    'gallery',
    'services',
    'about',
    'contact',
    'generic',
  ]) {
    if (new RegExp(`\\b${type}\\b`, 'i').test(lower)) {
      return type === 'testimonial' ? 'testimonials' : type;
    }
  }
  const quoted = message.match(/["']([^"']{2,60})["']/);
  if (quoted?.[1]) return quoted[1].trim().toLowerCase();
  return null;
}

/**
 * L0: remove a section from siteConfig.sections by type or title match.
 */
export async function runSectionRemoveStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  if (options.mode !== 'gitlab') return null;

  const target = parseRemoveTarget(options.ownerMessage);
  if (!target) return null;

  const content = await readWorkspaceRel(options, SITE_CONFIG);
  if (!content || !/sections\s*:\s*\[/.test(content)) return null;

  const sectionBlocks = [...content.matchAll(/\{\s*type\s*:\s*['"]([^'"]+)['"][^}]*\}/g)];
  if (sectionBlocks.length === 0) return null;

  const filtered = sectionBlocks.filter((block) => {
    const type = block[1]?.toLowerCase() ?? '';
    const titleMatch = block[0].match(/title\s*:\s*['"]([^'"]+)['"]/i);
    const title = titleMatch?.[1]?.toLowerCase() ?? '';
    return type !== target && title !== target && !title.includes(target);
  });

  if (filtered.length === sectionBlocks.length) return null;

  const newSectionsInner = filtered.map((m) => m[0]).join(',\n    ');
  const updated = content.replace(
    /sections\s*:\s*\[[\s\S]*?\]/,
    `sections: [\n    ${newSectionsInner}\n  ]`
  );

  if (updated === content) return null;

  await writeWorkspaceRel(options, SITE_CONFIG, updated);

  return buildStrategyResult(
    options,
    beforeHashes,
    'section_remove',
    'L0',
    `Removed the ${target} section.`,
    { confidence: 'high' }
  );
}
