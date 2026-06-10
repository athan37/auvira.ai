import type { ClarificationAnchor } from '@/lib/chat/projectMessageMetadata';
import { classifyEditWhat } from '@/lib/project-workspace/edit-context/classifyEditWhat';
import type { ImplicitReferenceRecord } from '@/lib/project-workspace/edit-context/implicitReferenceTypes';
import type { EditTarget } from '@/lib/project-workspace/edit-context/types';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

/** Classified edit intent for Monitor `classified_intent` (matches classifyEditWhat). */
export function classifiedIntentFromMessage(message: string): string {
  return classifyEditWhat(message);
}

/** Redacted pin payload for Monitor `selected_target`. */
export function serializeSelectedTargetForMonitor(
  target?: SelectedTargetInput | null
): Record<string, unknown> | undefined {
  if (!target) return undefined;

  const out: Record<string, unknown> = {
    kind: target.kind,
  };
  if (target.sectionId) out.section_id = target.sectionId;
  if (target.analyticsId) out.analytics_id = target.analyticsId;
  if (target.sectionIndex != null) out.section_index = target.sectionIndex;
  if (target.sectionType) out.section_type = target.sectionType;
  if (target.sectionTitle) out.section_title = target.sectionTitle;
  if (target.fieldPath) out.field_path = target.fieldPath;
  if (target.itemIndex != null) out.item_index = target.itemIndex;
  if (target.elementKind) out.element_kind = target.elementKind;
  if (target.elementLabel) out.element_label = target.elementLabel;
  if (target.surfaceId) out.surface_id = target.surfaceId;
  if (target.pinScope) out.pin_scope = target.pinScope;
  const hasPreview = Boolean(
    target.previewThumbnail?.previewUrl ||
      target.previewThumbnail?.publicUrl ||
      target.previewThumbnailDataUrl
  );
  if (hasPreview || target.previewThumbnail?.captureKind) {
    out.preview_thumbnail = {
      kind: target.previewThumbnail?.captureKind ?? target.elementKind ?? 'preview',
      has_preview: hasPreview || Boolean(target.previewThumbnail?.captureKind),
    };
  }
  if (target.targetChain?.length) {
    out.target_chain = target.targetChain.map((node) => ({
      role: node.role,
      label: node.label,
      kind: node.kind,
      field_path: node.fieldPath,
      item_index: node.itemIndex,
      surface_id: node.surfaceId,
    }));
  }
  return out;
}

/** Resolved target summary for Monitor `target_resolved`. */
export function serializeTargetResolvedForMonitor(input: {
  target?: EditTarget | null;
  clarificationAnchor?: ClarificationAnchor | null;
  selectedTarget?: SelectedTargetInput | null;
}): Record<string, unknown> | undefined {
  if (input.target) {
    const out: Record<string, unknown> = {
      kind: input.target.kind,
      confidence: input.target.confidence,
      needs_clarification: input.target.needsClarification,
    };
    if (input.target.sectionIndex != null) out.section_index = input.target.sectionIndex;
    if (input.target.sectionType) out.section_type = input.target.sectionType;
    if (input.target.title) out.title = input.target.title;
    if (input.target.fieldPath) out.field_path = input.target.fieldPath;
    if (input.target.rendererComponent) out.renderer_component = input.target.rendererComponent;
    return out;
  }

  if (input.clarificationAnchor) {
    const anchor = input.clarificationAnchor;
    return {
      kind: anchor.kind,
      section_index: anchor.sectionIndex,
      title: anchor.title,
      confidence: 'medium',
      needs_clarification: true,
    };
  }

  if (input.selectedTarget) {
    const pin = input.selectedTarget;
    return {
      kind: pin.kind,
      section_index: pin.sectionIndex,
      section_type: pin.sectionType,
      title: pin.sectionTitle ?? pin.elementLabel,
      field_path: pin.fieldPath,
      confidence: 'high',
      needs_clarification: false,
    };
  }

  return undefined;
}

/** Compact resolved implicit refs for Monitor `plan.resolved_references`. */
export function serializeResolvedReferencesForMonitor(
  references?: ImplicitReferenceRecord[] | null
): Array<Record<string, unknown>> | undefined {
  if (!references?.length) return undefined;
  return references.map((ref) => ({
    phrase: ref.phrase,
    resolved_value: ref.resolvedValue ?? null,
    resolved_kind: ref.resolvedKind ?? null,
    source: ref.source ?? null,
    confidence: ref.confidence ?? null,
  }));
}

/** Whether clarification happened before planEdit (implicit/structural gates). */
export function inferPreGateBlocked(input: {
  needsClarification?: boolean;
  plannerPath?: string;
}): boolean {
  if (!input.needsClarification) return false;
  if (input.plannerPath === 'clarification') return true;
  if (!input.plannerPath) return true;
  return false;
}
