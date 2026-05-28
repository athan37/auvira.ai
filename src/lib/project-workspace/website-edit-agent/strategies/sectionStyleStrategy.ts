import {
  extractColorsFromMessage,
  parseColorSwap,
  swapTailwindColorInText,
} from '../preset/presetUtils';
import {
  buildStrategyResult,
  PAGE_TSX,
  SITE_CONFIG,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '../strategyContext';
import { extractSectionComponentSource } from '../resolveSectionTarget';
import { updateSectionBackgroundColorInSource } from '../../website-edit-agent-v2/siteConfigMutations';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

function tailwindBgClass(color: string): string {
  return `bg-${color}-100`;
}

async function tryConfigPresentationUpdate(
  options: WebsiteEditAgentOptions,
  sectionIndex: number,
  toColor: string
): Promise<boolean> {
  const siteConfigContent = await readWorkspaceRel(options, SITE_CONFIG);
  if (!siteConfigContent) return false;

  const updated = updateSectionBackgroundColorInSource(siteConfigContent, sectionIndex, toColor);
  if (!updated || updated === siteConfigContent) return false;

  await writeWorkspaceRel(options, SITE_CONFIG, updated);
  return true;
}

async function tryPageComponentPatch(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>,
  componentName: string,
  toColor: string,
  swap: ReturnType<typeof parseColorSwap>
): Promise<WebsiteEditAgentResult | null> {
  const pageContent = await readWorkspaceRel(options, PAGE_TSX);
  if (!pageContent) return null;

  const extracted = extractSectionComponentSource(pageContent, componentName);
  if (!extracted) return null;

  let componentBody = extracted.content;
  let patched = false;

  if (swap) {
    const next = swapTailwindColorInText(componentBody, swap.fromColor, swap.toColor);
    patched = next !== componentBody;
    componentBody = next;
  } else {
    const bgClass = tailwindBgClass(toColor);
    const next = componentBody.replace(
      /(<section[^>]*className=\{)([^}]+)(\})/,
      (_match, pre, inner, post) => {
        if (inner.includes(bgClass)) return _match;
        patched = true;
        const stripped = inner.replace(/\+\s*preset\.(?:surfaceBg|mutedBg|pageBg|contactBg)/g, '');
        const strippedResolvers = stripped.replace(
          /\+\s*resolveSectionBackground\([^)]+\)/g,
          ''
        );
        return `${pre}${strippedResolvers} + "${bgClass}"${post}`;
      }
    );
    componentBody = next;
  }

  if (!patched) return null;

  const start = pageContent.indexOf(extracted.content);
  if (start < 0) return null;

  const newPage =
    pageContent.slice(0, start) + componentBody + pageContent.slice(start + extracted.content.length);

  await writeWorkspaceRel(options, PAGE_TSX, newPage);

  return buildStrategyResult(
    options,
    beforeHashes,
    'section_style',
    'L0',
    `Updated ${componentName} background in page.tsx (legacy path).`,
    { confidence: 'medium' }
  );
}

/**
 * L0: section-scoped background via siteConfig.presentation first, page.tsx patch as fallback.
 */
export async function runSectionStyleStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  const plan = options.editTargetPlan;
  if (
    options.mode !== 'gitlab' ||
    !plan ||
    plan.what !== 'style_background' ||
    plan.where.kind !== 'section' ||
    plan.where.sectionIndex == null
  ) {
    return null;
  }

  const swap = parseColorSwap(options.ownerMessage);
  const colors = extractColorsFromMessage(options.ownerMessage);
  const toColor = swap?.toColor ?? colors[colors.length - 1];
  if (!toColor) return null;

  const sectionIndex = plan.where.sectionIndex;
  const sectionLabel = plan.where.title ?? `section ${sectionIndex}`;

  const configUpdated = await tryConfigPresentationUpdate(options, sectionIndex, toColor);
  if (configUpdated) {
    const summary = swap
      ? `Changed background of "${sectionLabel}" from ${swap.fromColor} to ${swap.toColor}.`
      : `Changed background of "${sectionLabel}" to ${toColor}.`;
    return buildStrategyResult(options, beforeHashes, 'section_style', 'L0', summary, {
      confidence: 'high',
    });
  }

  const componentName = plan.where.rendererComponent;
  if (!componentName) return null;

  return tryPageComponentPatch(options, beforeHashes, componentName, toColor, swap);
}
