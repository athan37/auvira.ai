import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import type { EditPlan } from '@/lib/project-workspace/planner/editPlan.schema';
import { parseConfigFieldPath } from '@/lib/project-workspace/edit-context/configFieldPaths';
import type { ExplorerApplyResult } from '@/lib/project-workspace/edit-context/exploreSectionTarget';
import type { SectionSurface } from '@/lib/project-workspace/edit-context/sectionSurfaceCatalog';
import { extractSectionBackgroundClassFromMessage } from '@/lib/builder/sectionPresentation';
import { extractBackgroundColorFromMessage } from '@/lib/project-workspace/edit-shared/preset/presetUtils';

/** Build deterministic copy plan from explorer apply result. */
export function planFromExplorerApply(
  editContext: EditContext,
  apply: ExplorerApplyResult
): EditPlan {
  const parsed = parseConfigFieldPath(apply.fieldPath);
  const sectionIndex =
    parsed?.sectionIndex ?? editContext.target.sectionIndex ?? undefined;

  const targets =
    sectionIndex != null
      ? [
          {
            kind: 'section' as const,
            sectionIndex,
            sectionTitle: editContext.target.title,
            sectionType: editContext.target.sectionType,
            field: apply.fieldPath,
          },
        ]
      : undefined;

  return {
    planVersion: 'website-agent',
    needsClarification: false,
    intent: 'copy',
    targets,
    verification: [
      {
        kind: 'copy_field',
        field: apply.fieldPath,
        sectionIndex,
        expectedValue: apply.value,
      },
    ],
    risk: { level: editContext.riskFlags.level, reasons: editContext.riskFlags.reasons },
    steps: [
      {
        skill: 'update_config_field',
        params: { fieldPath: apply.fieldPath, value: apply.value },
      },
    ],
  };
}

/** Build style plan when explorer resolves presentation fieldPath. */
export function planFromExplorerStyleApply(
  editContext: EditContext,
  fieldPath: string,
  presentationField: 'backgroundClass' | 'cardClass'
): EditPlan | null {
  const sectionIndex = editContext.target.sectionIndex;
  if (sectionIndex == null) return null;

  const message = editContext.effectiveMessage;
  const bgClass = extractSectionBackgroundClassFromMessage(message);
  const color = extractBackgroundColorFromMessage(message);
  if (!bgClass && !color) return null;

  return {
    planVersion: 'website-agent',
    needsClarification: false,
    intent: 'style',
    targets: [
      {
        kind: 'section',
        sectionIndex,
        sectionTitle: editContext.target.title,
        sectionType: editContext.target.sectionType,
      },
    ],
    verification: [
      {
        kind: 'section_background',
        sectionIndex,
        field: presentationField,
        expectedValue: bgClass ?? undefined,
      },
    ],
    risk: { level: editContext.riskFlags.level, reasons: editContext.riskFlags.reasons },
    steps: [
      {
        skill: 'update_section_style',
        target: {
          sectionIndex,
          sectionType: editContext.target.sectionType,
          title: editContext.target.title,
        },
        params: {
          backgroundClass: bgClass ?? undefined,
          backgroundColor: color ?? undefined,
          presentationField,
          fieldPath,
        },
      },
    ],
  };
}

/** Human-label clarification plan for ambiguous surfaces. */
export function planFromExplorerClarify(
  editContext: EditContext,
  surfaces: SectionSurface[],
  sectionTitle?: string
): EditPlan {
  const title = sectionTitle ?? editContext.target.title ?? 'this section';
  const lines = surfaces.slice(0, 5).map((s, i) => {
    const preview = s.visibleText
      ? ` ("${s.visibleText.slice(0, 48)}${s.visibleText.length > 48 ? '…' : ''}")`
      : '';
    return `${i + 1}. ${s.humanLabel}${preview}`;
  });

  return {
    planVersion: 'website-agent',
    needsClarification: true,
    clarificationQuestion:
      `Which part of **${title}** should change?\n\n` + lines.join('\n'),
    suggestedReplies: surfaces.slice(0, 5).map((s) => s.humanLabel),
    intent: 'clarification',
    steps: [],
    risk: { level: editContext.riskFlags.level, reasons: editContext.riskFlags.reasons },
  };
}
