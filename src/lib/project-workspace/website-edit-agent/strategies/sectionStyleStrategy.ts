import {
  extractColorsFromMessage,
  parseColorSwap,
  swapTailwindColorInText,
} from '../preset/presetUtils';
import {
  buildStrategyResult,
  PAGE_TSX,
  readWorkspaceRel,
  writeWorkspaceRel,
} from '../strategyContext';
import { extractSectionComponentSource } from '../resolveSectionTarget';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

function tailwindBgClass(color: string): string {
  return `bg-${color}-100`;
}

/**
 * L0: patch section component className for section-scoped background (not global preset).
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
    plan.where.sectionIndex == null ||
    !plan.where.rendererComponent
  ) {
    return null;
  }

  const pageContent = await readWorkspaceRel(options, PAGE_TSX);
  if (!pageContent) return null;

  const componentName = plan.where.rendererComponent;
  const extracted = extractSectionComponentSource(pageContent, componentName);
  if (!extracted) return null;

  const swap = parseColorSwap(options.ownerMessage);
  const colors = extractColorsFromMessage(options.ownerMessage);
  const toColor = swap?.toColor ?? colors[colors.length - 1];
  if (!toColor) return null;

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
        return `${pre}${stripped} + "${bgClass}"${post}`;
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

  const sectionLabel = plan.where.title ?? `section ${plan.where.sectionIndex}`;
  const summary = swap
    ? `Changed background of "${sectionLabel}" from ${swap.fromColor} to ${swap.toColor}.`
    : `Changed background of "${sectionLabel}" to ${toColor}.`;

  return buildStrategyResult(
    options,
    beforeHashes,
    'section_style',
    'L0',
    summary,
    { confidence: 'high' }
  );
}
