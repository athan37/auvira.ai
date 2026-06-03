import type { SiteSectionPresentation } from '@/lib/builder/sectionPresentation';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { extractSiteConfigSectionBlock } from '@/lib/project-workspace/edit-shared/extractEditCodeContext';
import type { SelectedTargetInput } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';
import type { SiteSectionCatalog } from '@/lib/project-workspace/edit-shared/siteSectionCatalog';
import {
  heroFieldPath,
  parseConfigFieldPath,
  readConfigFieldValue,
} from './configFieldPaths';
import {
  enumerateAllowlistedFields,
  filterFieldsToSection,
} from './enumerateAllowlistedFields';
import type { EditTarget } from './types';

export type EditableFieldConfidence = 'high' | 'medium' | 'low';

export interface EditableFieldDescriptor {
  fieldPath: string;
  label: string;
  currentValue?: unknown;
  confidence: EditableFieldConfidence;
  reason: string;
}

export interface SelectedTargetContextSectionItem {
  index: number;
  title?: string;
  description?: string;
  label?: string;
  imageUrl?: string;
  href?: string;
  alt?: string;
}

export interface SelectedTargetContext {
  target: SelectedTargetInput;
  resolved: {
    kind: 'hero' | 'section';
    sectionIndex?: number;
    sectionId?: string;
    sectionType?: string;
    sectionTitle?: string;
    rendererComponent?: string;
    confidence: 'high' | 'medium' | 'low';
  };
  section?: {
    title?: string;
    subtitle?: string;
    body?: string;
    presentation?: SiteSectionPresentation;
    items?: SelectedTargetContextSectionItem[];
  };
  element?: {
    kind?: string;
    role?: string;
    label?: string;
    textPreview?: string;
    itemIndex?: number;
    fieldPath?: string;
    currentValue?: unknown;
  };
  editableFields: EditableFieldDescriptor[];
  sourceHints: {
    siteConfigPath: 'src/lib/siteConfig.ts';
    pagePath?: 'src/app/page.tsx';
    configLineRange?: { startLine: number; endLine: number };
    rendererComponent?: string;
    rendererUsesPresentation?: boolean;
  };
  recommendedDefaultField?: {
    fieldPath: string;
    reason: string;
  };
  styleTargets?: Array<{
    presentationField: 'backgroundClass' | 'cardClass';
    label: string;
    configPath: string;
    currentValue?: string;
  }>;
}

export interface BuildSelectedTargetContextInput {
  selectedTarget: SelectedTargetInput;
  siteConfigContent: string;
  pageContent?: string | null;
  catalog: SiteSectionCatalog;
  target: EditTarget;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function buildHeroFields(siteConfigContent: string): EditableFieldDescriptor[] {
  return enumerateAllowlistedFields(siteConfigContent)
    .filter((entry) => entry.scope === 'hero')
    .map((entry) => ({
      fieldPath: entry.fieldPath,
      label: `Hero ${entry.field}`,
      currentValue: entry.value,
      confidence: 'high' as const,
      reason: 'Hero text field',
    }));
}

function buildSectionFields(
  siteConfigContent: string,
  sectionIndex: number
): EditableFieldDescriptor[] {
  return filterFieldsToSection(enumerateAllowlistedFields(siteConfigContent), sectionIndex).map(
    (entry) => ({
      fieldPath: entry.fieldPath,
      label:
        entry.scope === 'sectionItem'
          ? `Item ${(entry.itemIndex ?? 0) + 1} ${entry.field}`
          : `Section ${entry.field}`,
      currentValue: entry.value,
      confidence:
        entry.field === 'title' || entry.field === 'label' ? ('high' as const) : ('medium' as const),
      reason:
        entry.scope === 'sectionItem'
          ? `Section item ${entry.itemIndex} ${entry.field}`
          : `Section-level ${entry.field}`,
    })
  );
}

function buildStyleTargets(
  sectionIndex: number,
  presentation?: SiteSectionPresentation,
  sectionType?: string
): NonNullable<SelectedTargetContext['styleTargets']> {
  const targets: NonNullable<SelectedTargetContext['styleTargets']> = [
    {
      presentationField: 'backgroundClass',
      label: 'Section wrapper background',
      configPath: `sections[${sectionIndex}].presentation.backgroundClass`,
      currentValue: presentation?.backgroundClass,
    },
    {
      presentationField: 'cardClass',
      label:
        sectionType === 'contact'
          ? 'Contact Information panel (inner card)'
          : 'Inner card / panel background',
      configPath: `sections[${sectionIndex}].presentation.cardClass`,
      currentValue: presentation?.cardClass,
    },
  ];
  return targets;
}

/**
 * Build rich context for a UI-pinned preview target.
 */
export function buildSelectedTargetContext(
  input: BuildSelectedTargetContextInput
): SelectedTargetContext | null {
  const { selectedTarget, siteConfigContent, pageContent, catalog, target } = input;
  if (!selectedTarget) return null;

  const parsedConfig = parseSiteConfigSource(siteConfigContent);
  const configObject = parsedConfig as unknown as Record<string, unknown>;

  const resolved = {
    kind: selectedTarget.kind as 'hero' | 'section',
    sectionIndex: target.sectionIndex,
    sectionId: selectedTarget.sectionId ?? selectedTarget.analyticsId,
    sectionType: target.sectionType ?? selectedTarget.sectionType,
    sectionTitle: target.title ?? selectedTarget.sectionTitle,
    rendererComponent: target.rendererComponent,
    confidence: target.confidence,
  };

  const editableFields =
    selectedTarget.kind === 'hero'
      ? buildHeroFields(siteConfigContent)
      : target.sectionIndex != null
        ? buildSectionFields(siteConfigContent, target.sectionIndex)
        : [];

  let sectionSlice: SelectedTargetContext['section'];
  if (target.sectionIndex != null && parsedConfig?.sections?.[target.sectionIndex]) {
    const raw = parsedConfig.sections[target.sectionIndex] as Record<string, unknown>;
    const items = Array.isArray(raw.items)
      ? (raw.items as Array<Record<string, unknown>>).map((item, index) => ({
          index,
          title: typeof item.title === 'string' ? item.title : undefined,
          description: typeof item.description === 'string' ? item.description : undefined,
          label: typeof item.label === 'string' ? item.label : undefined,
          imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
          href: typeof item.href === 'string' ? item.href : undefined,
          alt: typeof item.alt === 'string' ? item.alt : undefined,
        }))
      : undefined;

    sectionSlice = {
      title: typeof raw.title === 'string' ? raw.title : undefined,
      subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : undefined,
      body: typeof raw.body === 'string' ? raw.body : undefined,
      presentation: raw.presentation as SiteSectionPresentation | undefined,
      items,
    };
  }

  const elementFieldPath = selectedTarget.fieldPath;
  const elementItemIndex = selectedTarget.itemIndex;
  let element: SelectedTargetContext['element'];
  if (selectedTarget.elementKind || elementFieldPath) {
    const parsedPath = elementFieldPath ? parseConfigFieldPath(elementFieldPath) : null;
    element = {
      kind: selectedTarget.elementKind,
      label: selectedTarget.elementLabel,
      itemIndex: elementItemIndex ?? parsedPath?.itemIndex,
      fieldPath: elementFieldPath,
      currentValue: parsedPath ? readConfigFieldValue(configObject, parsedPath) : undefined,
    };
  }

  const block =
    target.sectionIndex != null
      ? extractSiteConfigSectionBlock(siteConfigContent, target.sectionIndex)
      : null;

  const recommendedDefaultField = pickRecommendedDefaultField(
    selectedTarget,
    editableFields,
    element?.fieldPath
  );

  const styleTargets =
    target.sectionIndex != null
      ? buildStyleTargets(
          target.sectionIndex,
          sectionSlice?.presentation,
          resolved.sectionType
        )
      : undefined;

  return {
    target: selectedTarget,
    resolved,
    section: sectionSlice,
    element,
    editableFields,
    sourceHints: {
      siteConfigPath: 'src/lib/siteConfig.ts',
      pagePath: pageContent ? 'src/app/page.tsx' : undefined,
      configLineRange: block
        ? { startLine: block.startLine, endLine: block.endLine }
        : undefined,
      rendererComponent: target.rendererComponent,
      rendererUsesPresentation: Boolean(sectionSlice?.presentation?.backgroundClass),
    },
    recommendedDefaultField,
    styleTargets,
  };
}

function pickRecommendedDefaultField(
  target: SelectedTargetInput,
  fields: EditableFieldDescriptor[],
  elementFieldPath?: string
): SelectedTargetContext['recommendedDefaultField'] {
  if (elementFieldPath) {
    return { fieldPath: elementFieldPath, reason: 'UI-pinned element field path' };
  }
  if (target.fieldPath) {
    return { fieldPath: target.fieldPath, reason: 'UI-pinned field path' };
  }
  if (target.kind === 'hero') {
    const headline = fields.find((f) => f.fieldPath === heroFieldPath('headline'));
    if (headline) {
      return { fieldPath: headline.fieldPath, reason: 'Default hero headline field' };
    }
  }
  const titleField = fields.find((f) => f.fieldPath.endsWith('.title'));
  if (titleField) {
    return { fieldPath: titleField.fieldPath, reason: 'Default section title field' };
  }
  const first = fields[0];
  if (first) {
    return { fieldPath: first.fieldPath, reason: 'Nearest editable text field' };
  }
  return undefined;
}

/** Format selected target context block for planner prompts. */
export function formatSelectedTargetContextBlock(ctx: SelectedTargetContext): string {
  const lines: string[] = ['UI-SELECTED TARGET:'];
  lines.push(`- kind: ${ctx.resolved.kind}`);
  if (ctx.resolved.sectionIndex != null) {
    lines.push(`- sectionIndex: ${ctx.resolved.sectionIndex}`);
  }
  if (ctx.resolved.sectionType) lines.push(`- type: ${ctx.resolved.sectionType}`);
  if (ctx.resolved.sectionId) lines.push(`- id: ${ctx.resolved.sectionId}`);
  if (ctx.resolved.sectionTitle) lines.push(`- title: ${ctx.resolved.sectionTitle}`);
  if (ctx.element?.kind) lines.push(`- element: ${ctx.element.kind}`);
  if (ctx.element?.fieldPath) lines.push(`- elementFieldPath: ${ctx.element.fieldPath}`);

  lines.push('', 'SELECTED TARGET CONTEXT:');
  if (ctx.section?.title) lines.push(`- Current title: "${ctx.section.title}"`);
  if (ctx.section?.subtitle) lines.push(`- Current subtitle: "${ctx.section.subtitle}"`);
  if (ctx.section?.body) {
    const body =
      ctx.section.body.length > 160 ? `${ctx.section.body.slice(0, 157)}…` : ctx.section.body;
    lines.push(`- Current body: "${body}"`);
  }
  if (ctx.section?.items?.length) {
    lines.push('- Items:');
    ctx.section.items.forEach((item) => {
      const parts = [
        item.title ? `"${item.title}"` : null,
        item.description ? `— "${item.description}"` : null,
        item.label ? `[label: ${item.label}]` : null,
      ].filter(Boolean);
      lines.push(`  ${item.index}. ${parts.join(' ')}`);
    });
  }

  if (ctx.editableFields.length) {
    lines.push('', 'EDITABLE FIELDS:');
    ctx.editableFields.slice(0, 12).forEach((field, i) => {
      const value =
        field.currentValue == null
          ? '(empty)'
          : `"${String(field.currentValue).slice(0, 80)}${String(field.currentValue).length > 80 ? '…' : ''}"`;
      lines.push(`${i + 1}. ${field.fieldPath} = ${value} (${field.confidence})`);
    });
  }

  if (ctx.recommendedDefaultField) {
    lines.push(
      '',
      `RECOMMENDED DEFAULT FIELD: ${ctx.recommendedDefaultField.fieldPath} — ${ctx.recommendedDefaultField.reason}`
    );
  }

  if (ctx.styleTargets?.length) {
    lines.push('', 'STYLABLE PRESENTATION TARGETS:');
    ctx.styleTargets.forEach((target, i) => {
      const value = target.currentValue ?? '(preset default)';
      lines.push(
        `${i + 1}. ${target.label} → ${target.configPath} = ${value} [${target.presentationField}]`
      );
    });
    lines.push(
      '- When the owner names an inner element ("contact information", "card", "info panel"), use presentation.cardClass — not backgroundClass.',
      '- Use presentation.backgroundClass only for the outer section wrapper.'
    );
  }

  lines.push(
    '',
    'RULES:',
    '- Treat UI-selected target as pinned; do not pick a different section unless the user explicitly names another.',
    '- If the user says "title", use the most likely title field from EDITABLE FIELDS.',
    '- Prefer config field paths and domain skills over custom_code_edit.',
    '- Style/color requests → update_section_style on the pinned sectionIndex.',
    '- If the requested field is missing, choose the closest editable field or ask which field to update (not which section).'
  );

  return lines.join('\n');
}
