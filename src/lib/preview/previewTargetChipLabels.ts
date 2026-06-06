import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import { parseConfigFieldPath } from '@/lib/project-workspace/edit-context/configFieldPaths';
import { sectionTypeLabel } from '@/lib/preview/previewTargetVisuals';
import { resolvePinScope, resolveTargetChain, type TargetChainNode } from '@/lib/preview/targetChain';

export type PreviewTargetChipVariant = 'pinned' | 'used';

export interface PreviewTargetLayers {
  /** Top-level target (section, hero, etc.). */
  parent: string;
  /** Nested element/field labels under the parent. */
  children: string[];
}

export interface PreviewTargetChainRow {
  role: TargetChainNode['role'];
  kind?: string;
  label: string;
  depth: number;
}

export interface PreviewTargetDisplayElement {
  kind?: string;
  label: string;
}

/** Structured labels for composer target card UI. */
export interface PreviewTargetDisplay {
  scopeLabel: string;
  title: string;
  element?: PreviewTargetDisplayElement;
  chainRows?: PreviewTargetChainRow[];
}

/** Human-readable element kind for breadcrumb segments (e.g. button → Button). */
export function humanElementKindLabel(kind: string | undefined): string {
  const normalized = kind?.trim().toLowerCase();
  if (!normalized) return 'Element';
  switch (normalized) {
    case 'button':
      return 'Button';
    case 'heading':
      return 'Heading';
    case 'body':
      return 'Body text';
    case 'contact_field':
      return 'Contact field';
    case 'item_title':
      return 'Item title';
    case 'item_body':
      return 'Item body';
    case 'item_card':
      return 'Item card';
    case 'image_caption':
      return 'Caption';
    case 'panel':
      return 'Panel';
    default:
      return normalized.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function chainRowsFromTarget(target: SelectedTargetInput): PreviewTargetChainRow[] {
  const chain = resolveTargetChain(target);
  if (chain.length <= 1) return [];
  return chain.slice(1).map((node, index) => ({
    role: node.role,
    kind: node.kind,
    label: node.label,
    depth: index + 1,
  }));
}

/** Hierarchical breadcrumb rows (section row excluded — shown in header). */
export function formatPreviewTargetChain(target: SelectedTargetInput): PreviewTargetChainRow[] {
  return chainRowsFromTarget(target);
}

function fieldPathLabel(fieldPath: string): string | null {
  const parsed = parseConfigFieldPath(fieldPath);
  if (!parsed) return null;
  if (parsed.scope === 'hero') return parsed.field;
  if (parsed.scope === 'section') return parsed.field;
  if (parsed.scope === 'sectionItem') {
    return `item ${(parsed.itemIndex ?? 0) + 1} ${parsed.field}`;
  }
  return parsed.field;
}

function sectionParentLabel(target: SelectedTargetInput): string {
  const title = target.sectionTitle?.trim();
  const type = target.sectionType?.trim();
  if (title && type && title.toLowerCase() !== type.toLowerCase()) {
    return `${type}: ${title}`;
  }
  return title || type || 'Section';
}

function nestedChildLabels(target: SelectedTargetInput): string[] {
  const chainRows = chainRowsFromTarget(target);
  if (chainRows.length > 0) return chainRows.map((row) => row.label);
  if (target.elementLabel?.trim()) {
    return [target.elementLabel.trim()];
  }
  if (target.fieldPath) {
    const fieldLabel = fieldPathLabel(target.fieldPath);
    if (fieldLabel) return [fieldLabel];
  }
  if (target.elementKind) {
    return [target.elementKind];
  }
  return [];
}

function resolveElementDisplay(target: SelectedTargetInput): PreviewTargetDisplayElement | undefined {
  if (target.elementLabel?.trim()) {
    return { kind: target.elementKind, label: target.elementLabel.trim() };
  }
  if (target.fieldPath) {
    const fieldLabel = fieldPathLabel(target.fieldPath);
    if (fieldLabel) return { kind: target.elementKind, label: fieldLabel };
  }
  if (target.elementKind) {
    return { kind: target.elementKind, label: target.elementKind };
  }
  return undefined;
}

/** Structured display model for pinned target card (badge + title + optional element). */
export function formatPreviewTargetDisplay(target: SelectedTargetInput): PreviewTargetDisplay {
  if (target.kind === 'hero') {
    const element = resolveElementDisplay(target);
    if (element?.label.toLowerCase() === 'hero') {
      return { scopeLabel: 'Hero', title: 'Hero' };
    }
    return {
      scopeLabel: 'Hero',
      title: target.sectionTitle?.trim() || 'Hero',
      element,
    };
  }

  const title = target.sectionTitle?.trim();
  const type = target.sectionType?.trim();
  const scopeLabel = sectionTypeLabel(type);
  const displayTitle =
    title && type && title.toLowerCase() !== type.toLowerCase()
      ? title
      : title || scopeLabel;

  return {
    scopeLabel,
    title: displayTitle,
    element: resolveElementDisplay(target),
    chainRows: chainRowsFromTarget(target),
  };
}

/** The single line users care about (leaf element label, else section title). */
export function formatPreviewTargetPrimaryLabel(target: SelectedTargetInput): string {
  const display = formatPreviewTargetDisplay(target);
  const chainRows = display.chainRows ?? [];
  if (chainRows.length > 0) {
    const leaf = chainRows[chainRows.length - 1]?.label?.trim();
    if (leaf && leaf.toLowerCase() !== display.scopeLabel.toLowerCase()) {
      return leaf;
    }
  }
  if (
    display.element?.label &&
    display.element.label.toLowerCase() !== display.scopeLabel.toLowerCase()
  ) {
    return display.element.label;
  }
  if (display.title && display.title.toLowerCase() !== display.scopeLabel.toLowerCase()) {
    return display.title;
  }
  return display.scopeLabel;
}

/** True when breadcrumb path adds context beyond scope badge + primary label. */
export function shouldShowTargetBreadcrumb(target: SelectedTargetInput): boolean {
  return formatPreviewTargetCompactBreadcrumb(target).length > 0;
}

/** Compact path for nested targets (section › containers › element kind). */
export function formatPreviewTargetCompactBreadcrumb(target: SelectedTargetInput): string {
  const display = formatPreviewTargetDisplay(target);
  const chain = resolveTargetChain(target);
  const primary = formatPreviewTargetPrimaryLabel(target).toLowerCase();
  const parts: string[] = [];

  if (resolvePinScope(target) === 'element' && chain.length >= 2) {
    const sectionNode = chain[0];
    if (sectionNode?.label?.trim()) {
      parts.push(sectionNode.label.trim());
    }
    for (let i = 1; i < chain.length - 1; i++) {
      const label = chain[i]?.label?.trim();
      if (label) parts.push(label);
    }
    const leaf = chain[chain.length - 1];
    if (leaf?.role === 'element') {
      const kindLabel = humanElementKindLabel(leaf.kind);
      if (kindLabel.toLowerCase() !== primary) {
        parts.push(kindLabel);
      }
    }
    return parts.filter(Boolean).join(' › ');
  }

  if (display.title && display.title.toLowerCase() !== display.scopeLabel.toLowerCase()) {
    parts.push(display.title);
  }
  const chainRows = display.chainRows ?? [];
  if (chainRows.length > 1) {
    parts.push(...chainRows.slice(0, -1).map((row) => row.label));
  }
  return parts.filter(Boolean).join(' › ');
}

/** Compact breadcrumb for used-variant pill (Contact · Title › Container › Item 3 › Element). */
export function formatPreviewTargetBreadcrumb(target: SelectedTargetInput): string {
  const display = formatPreviewTargetDisplay(target);
  const parts = [display.scopeLabel];
  if (display.title && display.title.toLowerCase() !== display.scopeLabel.toLowerCase()) {
    parts.push(display.title);
  }
  const chainLabels = display.chainRows?.map((row) => row.label) ?? [];
  const base = parts.join(' · ');
  if (chainLabels.length > 0) {
    return `${base} › ${chainLabels.join(' › ')}`;
  }
  if (display.element?.label) {
    return `${base} › ${display.element.label}`;
  }
  return base;
}

/** Parent + nested child layers for chip UI (X stays on parent row only). */
export function formatPreviewTargetLayers(target: SelectedTargetInput): PreviewTargetLayers {
  if (target.kind === 'hero') {
    const children = nestedChildLabels(target);
    if (children.length === 1 && children[0]?.toLowerCase() === 'hero') {
      return { parent: 'Hero', children: [] };
    }
    return { parent: 'Hero', children };
  }

  return {
    parent: sectionParentLabel(target),
    children: nestedChildLabels(target),
  };
}

/** Human-readable target name without variant prefix (e.g. "Hero", "Services › title"). */
export function formatPreviewTargetLabel(target: SelectedTargetInput): string {
  const { parent, children } = formatPreviewTargetLayers(target);
  if (children.length === 0) return parent;
  return `${parent} › ${children.join(' › ')}`;
}

/** Full chip label including variant prefix (e.g. "Pinned: Services › title"). */
export function formatPreviewTargetChipText(
  target: SelectedTargetInput,
  variant: PreviewTargetChipVariant
): string {
  const prefix = variant === 'pinned' ? 'Pinned' : 'Used';
  return `${prefix}: ${formatPreviewTargetLabel(target)}`;
}
