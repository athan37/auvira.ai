import { findSectionByAnalyticsId } from '@/lib/analytics/generated-sites/ensureAnalyticsIds';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import type { SiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import type { EditTarget, EditTargetCandidate } from './types';

function toCandidate(
  kind: 'section' | 'hero',
  sectionIndex: number | undefined,
  sectionType: string | undefined,
  title: string | undefined,
  reason: string
): EditTargetCandidate {
  return {
    kind,
    sectionIndex,
    sectionTitle: title,
    sectionType,
    confidence: 'high',
    reason,
  };
}

function staleTargetClarification(catalog: SiteSectionCatalog): EditTarget {
  return {
    kind: 'section',
    confidence: 'low',
    candidates: catalog.sections.map((s) =>
      toCandidate('section', s.index, s.type, s.title, 'Catalog fallback after stale selection')
    ),
    needsClarification: true,
    clarificationMessage:
      "I couldn't find the section you selected in the preview anymore. It may have been removed or reordered. Which section should I edit?\n\n" +
      catalog.sections.map((s, i) => `${i + 1}. [${s.index}] ${s.type} — "${s.title}"`).join('\n'),
    suggestedReplies: catalog.numberedReplies,
    reason: 'Stale UI-selected section',
  };
}

/**
 * Resolve UI-pinned selectedTarget to EditTarget (ID-first, index fallback).
 */
export function resolveSelectedTarget(
  selectedTarget: SelectedTargetInput | undefined,
  catalog: SiteSectionCatalog,
  siteConfigContent: string
): EditTarget | null {
  if (!selectedTarget) return null;

  if (selectedTarget.kind === 'hero') {
    return {
      kind: 'hero',
      confidence: 'high',
      candidates: [toCandidate('hero', undefined, 'hero', 'Hero', 'UI-selected hero')],
      needsClarification: false,
      reason: 'UI-selected hero',
    };
  }

  const lookupId = selectedTarget.sectionId ?? selectedTarget.analyticsId;
  if (lookupId && siteConfigContent) {
    const found = findSectionByAnalyticsId(siteConfigContent, lookupId);
    if (found.found && found.sectionIndex != null && found.sectionIndex >= 0) {
      const section = catalog.sections.find((s) => s.index === found.sectionIndex);
      const title = section?.title ?? found.section?.title ?? selectedTarget.sectionTitle;
      const sectionType = section?.type ?? found.section?.type ?? selectedTarget.sectionType;
      const reason =
        selectedTarget.sectionIndex != null && selectedTarget.sectionIndex !== found.sectionIndex
          ? `UI-selected section id "${lookupId}" (index corrected ${selectedTarget.sectionIndex} → ${found.sectionIndex})`
          : `UI-selected section id "${lookupId}"`;

      return {
        kind: 'section',
        sectionIndex: found.sectionIndex,
        sectionType,
        title,
        rendererComponent: section?.rendererComponent,
        confidence: 'high',
        candidates: [
          toCandidate('section', found.sectionIndex, sectionType, title, reason),
        ],
        needsClarification: false,
        reason,
      };
    }
    if (!found.found) {
      return staleTargetClarification(catalog);
    }
  }

  const index = selectedTarget.sectionIndex;
  if (index != null && index >= 0 && index < catalog.sections.length) {
    const section = catalog.sections.find((s) => s.index === index);
    if (section) {
      const typeOk =
        !selectedTarget.sectionType || selectedTarget.sectionType === section.type;
      const titleOk =
        !selectedTarget.sectionTitle ||
        section.title.toLowerCase() === selectedTarget.sectionTitle.toLowerCase();
      if (typeOk && titleOk) {
        return {
          kind: 'section',
          sectionIndex: section.index,
          sectionType: section.type,
          title: section.title,
          rendererComponent: section.rendererComponent,
          confidence: 'high',
          candidates: [
            toCandidate('section', section.index, section.type, section.title, 'UI-selected section index'),
          ],
          needsClarification: false,
          reason: 'UI-selected section index',
        };
      }
    }
  }

  return staleTargetClarification(catalog);
}

/** Append pinned target hint for planner visibility. */
export function formatSelectedTargetForMessage(
  selectedTarget: SelectedTargetInput,
  recommendedFieldPath?: string
): string {
  if (selectedTarget.kind === 'hero') {
    const fieldHint = selectedTarget.fieldPath ?? recommendedFieldPath;
    return fieldHint
      ? `(UI-selected section: hero "Hero", field ${fieldHint})`
      : '(UI-selected section: hero "Hero")';
  }
  const parts = [
    selectedTarget.sectionIndex != null ? `index ${selectedTarget.sectionIndex}` : null,
    selectedTarget.sectionId ? `id "${selectedTarget.sectionId}"` : null,
    selectedTarget.sectionTitle ? `title "${selectedTarget.sectionTitle}"` : null,
    selectedTarget.fieldPath ?? recommendedFieldPath
      ? `field ${selectedTarget.fieldPath ?? recommendedFieldPath}`
      : null,
  ].filter(Boolean);
  return `(UI-selected section: ${parts.join(', ')})`;
}
