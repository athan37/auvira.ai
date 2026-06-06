import { parseConfigFieldPath } from '@/lib/project-workspace/edit-context/configFieldPaths';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import { sectionTypeLabel } from '@/lib/preview/previewTargetVisuals';

export type TargetChainRole = 'section' | 'container' | 'item' | 'element';
export type PinScope = 'section' | 'element';

export interface TargetChainNode {
  role: TargetChainRole;
  kind?: string;
  label: string;
  fieldPath?: string;
  itemIndex?: number;
  itemPosition?: number;
  surfaceId?: string;
}

/** Deterministic surface id from allowlisted field path. */
export function surfaceIdFromFieldPath(fieldPath: string): string {
  return fieldPath.replace(/[\[\].]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function humanFieldPathLabel(fieldPath: string): string {
  const parsed = parseConfigFieldPath(fieldPath);
  if (!parsed) return fieldPath;
  if (parsed.scope === 'sectionItem') {
    return `item ${(parsed.itemIndex ?? 0) + 1} ${parsed.field}`;
  }
  return parsed.field;
}

export function leafContainerKind(
  chain: TargetChainNode[] | undefined
): string | undefined {
  const leaf = chain?.[chain.length - 1];
  return leaf?.role === 'container' ? leaf.kind : undefined;
}

export function isInnerCardContainerPin(target: Pick<SelectedTargetInput, 'targetChain'>): boolean {
  return leafContainerKind(resolveTargetChain(target)) === 'inner_card';
}

export function resolvePinScope(target: SelectedTargetInput): PinScope {
  if (target.pinScope === 'element' || target.pinScope === 'section') {
    return target.pinScope;
  }
  return target.fieldPath?.trim() ? 'element' : 'section';
}

export function leafChainNode(chain: TargetChainNode[] | undefined): TargetChainNode | undefined {
  if (!chain?.length) return undefined;
  for (let i = chain.length - 1; i >= 0; i--) {
    const node = chain[i];
    if (node?.role === 'element' || node?.fieldPath) return node;
  }
  return chain[chain.length - 1];
}

/** Inner card container when the UI pin ends on (or inside) a contact/hero card shell. */
export function findPinnedInnerCardContainer(
  chain: TargetChainNode[] | undefined
): TargetChainNode | undefined {
  if (!chain?.length) return undefined;
  const leaf = chain[chain.length - 1];
  if (leaf?.role === 'container' && leaf.kind === 'inner_card') return leaf;
  return chain.find((node) => node.role === 'container' && node.kind === 'inner_card');
}

export function allowedFieldPathsForTarget(target: SelectedTargetInput): string[] {
  if (resolvePinScope(target) !== 'element') return [];
  const leaf = leafChainNode(target.targetChain);
  const fieldPath = leaf?.fieldPath ?? target.fieldPath?.trim();
  if (!fieldPath || !parseConfigFieldPath(fieldPath)) return [];
  return [fieldPath];
}

/** Build a display chain from flat pin fields when bridge did not send targetChain. */
export function buildTargetChainFromFlat(target: SelectedTargetInput): TargetChainNode[] {
  const scope = sectionTypeLabel(target.sectionType);
  const title = target.sectionTitle?.trim() || scope;
  const chain: TargetChainNode[] = [
    {
      role: 'section',
      kind: target.sectionType,
      label: title.toLowerCase() !== scope.toLowerCase() ? `${scope}: ${title}` : title,
    },
  ];

  if (target.itemIndex != null && !target.fieldPath?.includes('.items[')) {
    const pos = target.itemIndex + 1;
    chain.push({
      role: 'item',
      kind: 'item',
      label: `Item ${pos}`,
      itemIndex: target.itemIndex,
      itemPosition: pos,
    });
  }

  if (target.fieldPath) {
    const parsed = parseConfigFieldPath(target.fieldPath);
    if (parsed?.scope === 'sectionItem' && parsed.itemIndex != null) {
      const pos = parsed.itemIndex + 1;
      const hasItem = chain.some((n) => n.role === 'item');
      if (!hasItem) {
        chain.push({
          role: 'item',
          kind: 'item',
          label: `Item ${pos}`,
          itemIndex: parsed.itemIndex,
          itemPosition: pos,
        });
      }
    }
    chain.push({
      role: 'element',
      kind: target.elementKind,
      label:
        target.elementLabel?.trim() || humanFieldPathLabel(target.fieldPath) || target.fieldPath,
      fieldPath: target.fieldPath,
      itemIndex: target.itemIndex ?? parsed?.itemIndex,
      itemPosition:
        target.itemIndex != null
          ? target.itemIndex + 1
          : parsed?.itemIndex != null
            ? parsed.itemIndex + 1
            : undefined,
      surfaceId: target.surfaceId ?? surfaceIdFromFieldPath(target.fieldPath),
    });
  }

  return chain;
}

export function resolveTargetChain(target: SelectedTargetInput): TargetChainNode[] {
  if (target.targetChain?.length) return target.targetChain;
  return buildTargetChainFromFlat(target);
}

export function enrichSelectedTarget(target: SelectedTargetInput): SelectedTargetInput {
  const pinScope = resolvePinScope(target);
  const targetChain = resolveTargetChain(target);
  const leaf = leafChainNode(targetChain);

  return {
    ...target,
    pinScope,
    targetChain,
    surfaceId: target.surfaceId ?? leaf?.surfaceId,
    fieldPath: target.fieldPath ?? leaf?.fieldPath,
    elementKind: target.elementKind ?? leaf?.kind,
    elementLabel: target.elementLabel ?? (leaf?.role === 'element' ? leaf.label : undefined),
    itemIndex: target.itemIndex ?? leaf?.itemIndex,
  };
}
