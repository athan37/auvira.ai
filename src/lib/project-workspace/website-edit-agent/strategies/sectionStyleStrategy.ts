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
import {
  ensureLegacyPageReadsPresentation,
  ensureTailwindPresentationSupport,
} from '../legacySectionPresentation';
import {
  applySectionBackgroundEdit,
  sectionBackgroundEditFromAgentOptions,
} from '../../sectionPresentationEdit';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from '../types';

function tailwindBgClass(color: string): string {
  return `bg-${color}-100`;
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
 * L0: section-scoped background via unified presentation pipeline.
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
  const componentName = plan.where.rendererComponent;

  const pipelineResult = await applySectionBackgroundEdit(
    sectionBackgroundEditFromAgentOptions(
      options,
      {
        sectionIndex,
        sectionType: plan.where.sectionType ?? 'generic',
        title: plan.where.title,
        rendererComponent: componentName,
      },
      toColor
    )
  );

  if (pipelineResult.ok) {
    return buildStrategyResult(
      options,
      beforeHashes,
      'section_style',
      'L0',
      pipelineResult.summary,
      { confidence: 'high' }
    );
  }

  if (options.infraBaselineReady === true) {
    return {
      ok: false,
      error: pipelineResult.invariantErrors.join('; ') || 'Section color edit failed invariants',
      summary: pipelineResult.summary,
      ownerMessage: pipelineResult.summary,
      strategy: 'section_style',
      tier: 'L0',
      confidence: 'high',
      changedFiles: pipelineResult.changedFiles,
    };
  }

  const tailwindPatched = await ensureTailwindPresentationSupport(options);
  const pageUpgraded =
    componentName == null
      ? false
      : await ensureLegacyPageReadsPresentation(options, componentName);

  if (pageUpgraded || tailwindPatched) {
    return buildStrategyResult(
      options,
      beforeHashes,
      'section_style',
      'L0',
      pipelineResult.summary || `Changed section ${sectionIndex} background to ${toColor}.`,
      { confidence: 'medium' }
    );
  }

  if (!componentName) return null;

  return tryPageComponentPatch(options, beforeHashes, componentName, toColor, swap);
}
