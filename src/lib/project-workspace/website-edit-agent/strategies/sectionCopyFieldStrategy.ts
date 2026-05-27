import { extractExplicitTargetValue } from './copyFieldStrategy';
import { findSectionObjectRanges } from '../resolveSectionTarget';
import {
  buildStrategyResult,
  readWorkspaceRel,
  SITE_CONFIG,
  writeWorkspaceRel,
} from '../strategyContext';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

function escapeForTsString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * L0: patch siteConfig.sections[i] title/body when section target is pre-resolved.
 */
export async function runSectionCopyFieldStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  const plan = options.editTargetPlan;
  if (
    options.mode !== 'gitlab' ||
    !plan ||
    plan.what !== 'copy' ||
    !plan.valueExplicit ||
    plan.where.kind !== 'section' ||
    plan.where.sectionIndex == null
  ) {
    return null;
  }

  const newValue = extractExplicitTargetValue(options.ownerMessage);
  if (!newValue) return null;

  const content = await readWorkspaceRel(options, SITE_CONFIG);
  if (!content) return null;

  const idx = plan.where.sectionIndex;
  const ranges = findSectionObjectRanges(content);
  const range = ranges[idx];
  if (!range) return null;

  const lines = content.split('\n');
  let sectionBlock = lines.slice(range.startLine - 1, range.endLine).join('\n');
  const lower = options.ownerMessage.toLowerCase();
  const escaped = escapeForTsString(newValue);

  if (/\btitle\b/.test(lower) || /\bheadline\b/.test(lower)) {
    if (/title\s*:\s*['"]/.test(sectionBlock)) {
      sectionBlock = sectionBlock.replace(/(title\s*:\s*)(['"])([^'"]*)\2/, `$1'${escaped}'`);
    } else if (/["']title["']\s*:\s*['"]/.test(sectionBlock)) {
      sectionBlock = sectionBlock.replace(
        /(["']title["']\s*:\s*)(['"])([^'"]*)\2/,
        `$1'${escaped}'`
      );
    }
  } else if (/\bbody\b/.test(lower) || /\btext\b/.test(lower)) {
    if (/body\s*:\s*['"]/.test(sectionBlock)) {
      sectionBlock = sectionBlock.replace(/(body\s*:\s*)(['"])([^'"]*)\2/, `$1'${escaped}'`);
    } else if (/["']body["']\s*:\s*['"]/.test(sectionBlock)) {
      sectionBlock = sectionBlock.replace(
        /(["']body["']\s*:\s*)(['"])([^'"]*)\2/,
        `$1'${escaped}'`
      );
    } else if (/title\s*:\s*['"]/.test(sectionBlock)) {
      sectionBlock = sectionBlock.replace(/(title\s*:\s*)(['"])([^'"]*)\2/, `$1'${escaped}'`);
    }
  } else if (/title\s*:\s*['"]/.test(sectionBlock)) {
    sectionBlock = sectionBlock.replace(/(title\s*:\s*)(['"])([^'"]*)\2/, `$1'${escaped}'`);
  }

  const updatedLines = [
    ...lines.slice(0, range.startLine - 1),
    sectionBlock,
    ...lines.slice(range.endLine),
  ];
  const updated = updatedLines.join('\n');

  if (updated === content) return null;

  await writeWorkspaceRel(options, SITE_CONFIG, updated);

  const sectionLabel = plan.where.title ?? `section ${idx}`;
  return buildStrategyResult(
    options,
    beforeHashes,
    'section_copy_field',
    'L0',
    `Updated text in "${sectionLabel}" to "${newValue}".`,
    { confidence: 'high' }
  );
}
