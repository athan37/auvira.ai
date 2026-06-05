import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';
import type { EditWhatKind } from '@/lib/project-workspace/edit-shared/types';
import { extractReplacementValue, messageTokens } from './configTextEditUtils';
import type { EditContext } from './types';
import {
  buildSectionSurfaceCatalog,
  type SectionSurface,
  type SectionSurfaceEditFamily,
} from './sectionSurfaceCatalog';
import { buildSectionElementCatalog, filterCatalogToPin } from './sectionElementRegistry';
import {
  extractTargetPhrase,
  matchSectionElementPhrase,
} from './matchSectionElementPhrase';

const PIN_BOOST = 100;
const SYNONYM_BOOST = 40;
const LABEL_MATCH_BOOST = 25;
const VISIBLE_TEXT_BOOST = 30;
const MIN_MARGIN = 8;

const PHRASE_SYNONYMS: Array<{ pattern: RegExp; surfaceHints: string[] }> = [
  {
    pattern: /\bcontact\s+information\b|\bcontact\s+info\b/i,
    surfaceHints: ['inner card heading', 'subtitle', 'contact information'],
  },
  {
    pattern: /\binner\s+card\b|\binfo\s+(?:box|panel|card)\b/i,
    surfaceHints: ['inner card', 'cardClass', 'subtitle'],
  },
  {
    pattern: /\bsection\s+(?:title|heading)\b/i,
    surfaceHints: ['section title', 'title'],
  },
  {
    pattern: /\bsection\s+(?:intro|body|text)\b/i,
    surfaceHints: ['section intro', 'body'],
  },
  {
    pattern: /\b(?:card|inner)\s+background\b/i,
    surfaceHints: ['inner card background', 'cardClass'],
  },
  {
    pattern: /\bsection\s+background\b|\bwhole\s+section\b/i,
    surfaceHints: ['section background', 'backgroundClass'],
  },
];

export interface ExplorerApplyResult {
  kind: 'apply';
  fieldPath: string;
  value: string;
  surface: SectionSurface;
  reason: string;
}

export interface ExplorerNeedsLlmResult {
  kind: 'needs_llm';
  candidates: SectionSurface[];
  value?: string;
}

export type ExploreSectionTargetResult =
  | ExplorerApplyResult
  | ExplorerNeedsLlmResult
  | { kind: 'none' };

function editFamilyFromWhat(what: EditWhatKind): SectionSurfaceEditFamily {
  if (what === 'style_background' || what === 'style_card' || what === 'style_text') {
    return 'style';
  }
  return 'copy';
}

function scoreSurface(
  surface: SectionSurface,
  tokens: string[],
  message: string,
  pinFieldPath?: string
): number {
  let score = 0;
  if (pinFieldPath && surface.fieldPath === pinFieldPath) score += PIN_BOOST;

  const labelLower = surface.humanLabel.toLowerCase();
  const visibleLower = (surface.visibleText ?? '').toLowerCase();

  for (const token of tokens) {
    if (labelLower.includes(token) || token.includes(labelLower)) score += LABEL_MATCH_BOOST;
    if (visibleLower.includes(token)) score += VISIBLE_TEXT_BOOST;
  }

  for (const { pattern, surfaceHints } of PHRASE_SYNONYMS) {
    if (!pattern.test(message)) continue;
    for (const hint of surfaceHints) {
      if (
        labelLower.includes(hint) ||
        surface.fieldPath.includes(hint) ||
        visibleLower.includes(hint)
      ) {
        score += SYNONYM_BOOST;
      }
    }
  }

  if (surface.source === 'renderer_fallback' && /\bcontact\s+information\b/i.test(message)) {
    if (surface.fieldPath.includes('.subtitle')) score += SYNONYM_BOOST;
  }

  return score;
}

/**
 * Deterministic explorer: match user phrase to section surfaces without LLM.
 */
export function exploreSectionTargetDeterministic(
  editContext: EditContext
): ExploreSectionTargetResult {
  const sectionIndex =
    editContext.selectedTarget?.sectionIndex ?? editContext.target.sectionIndex;
  if (sectionIndex == null || !Number.isFinite(sectionIndex)) return { kind: 'none' };

  const siteConfigContent = editContext.siteModel.siteConfigContent ?? '';
  if (!siteConfigContent.trim()) return { kind: 'none' };

  const message = editContext.effectiveMessage;
  const what = classifyEditWhat(message);
  const editFamily = editFamilyFromWhat(what);

  const catalog = buildSectionSurfaceCatalog(siteConfigContent, sectionIndex, {
    selectedTarget: editContext.selectedTarget,
  });

  const phraseExtract = extractTargetPhrase(message);
  if (phraseExtract && editFamily === 'copy') {
    const elementCatalog = buildSectionElementCatalog(siteConfigContent, sectionIndex, {
      selectedTarget: editContext.selectedTarget,
    });
    const elementMatch = matchSectionElementPhrase(
      phraseExtract.targetPhrase,
      elementCatalog,
      message,
      phraseExtract.value
    );
    if (elementMatch.kind === 'apply') {
      return {
        kind: 'apply',
        fieldPath: elementMatch.fieldPath,
        value: elementMatch.value,
        surface: elementMatch.surface,
        reason: elementMatch.reason,
      };
    }
    if (elementMatch.kind === 'clarify') {
      return {
        kind: 'needs_llm',
        candidates: elementMatch.candidates,
        value: elementMatch.value,
      };
    }
  }

  let surfaces = catalog.filter((s) => s.editFamily === editFamily);
  if (surfaces.length === 0) surfaces = catalog.filter((s) => s.editFamily === 'copy');
  if (surfaces.length === 0) return { kind: 'none' };

  const pinCtx = editContext.selectedTargetContext;
  if (pinCtx?.pinnedElementOnly && pinCtx.allowedFieldPaths?.[0]) {
    surfaces = filterCatalogToPin(surfaces, {
      fieldPath: pinCtx.allowedFieldPaths[0],
      surfaceId: pinCtx.target.surfaceId,
    });
  }

  const pinPath =
    editContext.selectedTarget?.fieldPath ??
    editContext.selectedTargetContext?.element?.fieldPath;

  if (editContext.selectedTargetContext?.pinnedElementOnly && pinPath && editFamily === 'copy') {
    const value = extractReplacementValue(message);
    if (value) {
      const pinned = surfaces.find((s) => s.fieldPath === pinPath);
      if (pinned) {
        return {
          kind: 'apply',
          fieldPath: pinned.fieldPath,
          value,
          surface: pinned,
          reason: 'UI-pinned element-only scope',
        };
      }
    }
  }

  if (pinPath && editFamily === 'copy') {
    const pinned = surfaces.find((s) => s.fieldPath === pinPath);
    const value = extractReplacementValue(message);
    if (pinned && value) {
      return {
        kind: 'apply',
        fieldPath: pinned.fieldPath,
        value,
        surface: pinned,
        reason: 'UI-pinned element surface',
      };
    }
  }

  const value = editFamily === 'copy' ? extractReplacementValue(message) : undefined;
  if (editFamily === 'copy' && !value) return { kind: 'none' };

  const surfaceHint = message.match(/\(target surface:\s*([^)]+)\)/i)?.[1]?.trim().toLowerCase();
  const tokens = messageTokens(message);
  const scored = surfaces
    .map((surface) => {
      let score = scoreSurface(surface, tokens, message, pinPath);
      if (surfaceHint && surface.humanLabel.toLowerCase().includes(surfaceHint)) {
        score += PIN_BOOST;
      }
      return { surface, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    const fallbackSubtitle = surfaces.find((s) => s.fieldPath.endsWith('.subtitle'));
    if (
      fallbackSubtitle &&
      value &&
      /\bcontact\s+information\b/i.test(message)
    ) {
      return {
        kind: 'apply',
        fieldPath: fallbackSubtitle.fieldPath,
        value,
        surface: fallbackSubtitle,
        reason: 'Contact panel phrase → inner card heading (renderer fallback)',
      };
    }
    return { kind: 'needs_llm', candidates: surfaces.slice(0, 6), value: value ?? undefined };
  }

  const top = scored[0]!;
  const second = scored[1];
  if (second && top.score - second.score < MIN_MARGIN) {
    return {
      kind: 'needs_llm',
      candidates: scored.slice(0, 5).map((s) => s.surface),
      value: value ?? undefined,
    };
  }

  if (editFamily === 'style') {
    return {
      kind: 'needs_llm',
      candidates: scored.slice(0, 4).map((s) => s.surface),
    };
  }

  return {
    kind: 'apply',
    fieldPath: top.surface.fieldPath,
    value: value!,
    surface: top.surface,
    reason: `Deterministic surface match (score ${top.score})`,
  };
}
