import { updateActionItemsTool } from './actionItems';
import { applySectionBackgroundTool } from './applySectionBackground';
import { findSectionTool } from './findSection';
import {
  addSectionTool,
  removeSectionTool,
  reorderSectionsTool,
  updateSectionListTool,
} from './updateSectionList';
import { summarizeActualChangesTool } from './summarizeActualChanges';
import { updateContactInfoTool } from './updateContactInfo';
import { updateCopyFieldTool } from './updateCopyField';
import { updateConfigFieldTool } from './updateConfigField';
import { getSiteModelTool, replaceImageTool, updateThemeTool } from './updateTheme';
import { verifySourceInvariantsTool } from './verifySourceInvariants';
import {
  resolveContactUpdateField,
  resolveContactUpdateValue,
} from '@/lib/project-workspace/edit-context/resolveContactUpdateField';
import { stripPinnedTargetSuffix } from '@/lib/project-workspace/edit-context/configTextEditUtils';
import type { DomainToolContext, DomainToolHandler, DomainToolName, DomainToolResult } from './types';

const HANDLERS: Record<DomainToolName, DomainToolHandler> = {
  get_site_model: (ctx) => getSiteModelTool(ctx),
  find_section: findSectionTool,
  update_copy_field: updateCopyFieldTool,
  update_config_field: updateConfigFieldTool,
  update_contact_info: updateContactInfoTool,
  update_section_list: updateSectionListTool,
  update_action_items: updateActionItemsTool,
  apply_section_background: applySectionBackgroundTool,
  update_theme: updateThemeTool,
  add_section: addSectionTool,
  remove_section: removeSectionTool,
  reorder_sections: reorderSectionsTool,
  replace_image: replaceImageTool,
  verify_source_invariants: (ctx) => verifySourceInvariantsTool(ctx),
  summarize_actual_changes: (ctx) => summarizeActualChangesTool(ctx),
};

/** Map in-progress planner skill names to domain tools. */
export const SKILL_TO_DOMAIN_TOOL: Partial<Record<string, DomainToolName>> = {
  update_hero: 'update_copy_field',
  update_contact: 'update_contact_info',
  update_business_name: 'update_copy_field',
  update_section_copy: 'update_copy_field',
  update_config_field: 'update_config_field',
  update_section_item_copy: 'update_config_field',
  update_cta_label: 'update_config_field',
  update_theme: 'update_theme',
  update_section_style: 'apply_section_background',
  add_section: 'add_section',
  add_service: 'update_section_list',
  add_action_item: 'update_action_items',
  add_actions_section: 'update_action_items',
  update_action_item: 'update_action_items',
  remove_action_item: 'update_action_items',
  add_contact_extra_line: 'update_section_list',
  remove_section: 'remove_section',
  reorder_sections: 'reorder_sections',
  replace_image: 'replace_image',
};

/** Normalize planner step params for domain tool execution. */
export function paramsForSkill(
  skill: string,
  target: Record<string, unknown> | undefined,
  params: Record<string, unknown> | undefined,
  editContext: DomainToolContext['editContext']
): Record<string, unknown> {
  const merged = { ...target, ...params };

  if (skill === 'update_contact') {
    const message = stripPinnedTargetSuffix(editContext.effectiveMessage);
    const field = resolveContactUpdateField(merged, message);
    return { field, value: resolveContactUpdateValue(merged, field) };
  }

  if (skill === 'update_hero') {
    const field = (merged.field as string) ?? 'headline';
    return {
      scope: 'hero',
      field,
      value: merged.value ?? merged[field] ?? merged.headline,
    };
  }

  if (skill === 'update_business_name') {
    return {
      scope: 'business',
      field: 'businessName',
      value: merged.value ?? merged.businessName,
    };
  }

  if (skill === 'update_section_copy') {
    const fieldPath = merged.fieldPath as string | undefined;
    const field = (merged.field as string) ?? 'title';
    const sectionIndex =
      typeof merged.sectionIndex === 'number'
        ? merged.sectionIndex
        : editContext.target.sectionIndex;
    const value = merged.value ?? merged[field];
    if (fieldPath) {
      return { fieldPath, value };
    }
    return {
      scope: 'section',
      field,
      sectionIndex,
      value,
    };
  }

  if (
    skill === 'update_config_field' ||
    skill === 'update_section_item_copy' ||
    skill === 'update_cta_label'
  ) {
    return {
      fieldPath: merged.fieldPath ?? merged.field,
      value: merged.value,
    };
  }

  if (skill === 'update_section_style') {
    return {
      sectionIndex:
        typeof merged.sectionIndex === 'number'
          ? merged.sectionIndex
          : editContext.target.sectionIndex,
      backgroundClass: merged.backgroundClass,
      backgroundColor: merged.backgroundColor ?? merged.color,
      textClass: merged.textClass,
      presentationField: merged.presentationField,
      sectionType: merged.sectionType ?? editContext.target.sectionType,
      title: merged.title ?? editContext.target.title,
      rendererComponent: merged.rendererComponent ?? editContext.target.rendererComponent,
      ...(merged.presentation && typeof merged.presentation === 'object'
        ? (merged.presentation as Record<string, unknown>)
        : {}),
    };
  }

  if (skill === 'add_contact_extra_line') {
    return {
      action: 'add_contact_extra_line',
      value: merged.value ?? merged.line,
    };
  }

  if (skill === 'add_service') {
    return {
      action: 'add_service',
      title: merged.title,
      description: merged.description,
    };
  }

  if (skill === 'add_action_item') {
    return {
      action: 'add_action_item',
      name: merged.name ?? merged.title,
      description: merged.description,
      valueLabel: merged.valueLabel,
      actionType: merged.actionType,
      moduleKind: merged.moduleKind,
      ctaLabel: merged.ctaLabel,
      sectionTitle: merged.sectionTitle,
    };
  }

  if (skill === 'add_actions_section') {
    return {
      action: 'add_actions_section',
      moduleKind: merged.moduleKind,
      title: merged.title,
      subtitle: merged.subtitle ?? merged.body,
      defaultActionType: merged.defaultActionType,
      seedItem: merged.seedItem,
    };
  }

  if (skill === 'update_action_item') {
    return {
      action: 'update_action_item',
      sectionIndex: merged.sectionIndex ?? editContext.target.sectionIndex,
      itemIndex: merged.itemIndex,
      name: merged.name,
      description: merged.description,
      valueLabel: merged.valueLabel,
      ctaLabel: merged.ctaLabel,
      field: merged.field,
      value: merged.value,
      fieldPath: merged.fieldPath ?? editContext.target.fieldPath,
    };
  }

  if (skill === 'remove_action_item') {
    return {
      action: 'remove_action_item',
      sectionIndex: merged.sectionIndex ?? editContext.target.sectionIndex,
      itemIndex: merged.itemIndex,
    };
  }

  if (skill === 'remove_section') {
    return {
      sectionIndex:
        typeof merged.sectionIndex === 'number'
          ? merged.sectionIndex
          : editContext.target.sectionIndex,
    };
  }

  if (skill === 'reorder_sections') {
    const order = merged.order ?? merged.sectionOrder ?? merged.indices;
    if (Array.isArray(order)) {
      return { order };
    }
    return {
      fromIndex: merged.fromIndex,
      toIndex: merged.toIndex,
    };
  }

  return merged;
}

/**
 * Execute a domain tool by name.
 */
export async function executeDomainTool(
  name: DomainToolName,
  ctx: DomainToolContext,
  params: Record<string, unknown> = {}
): Promise<DomainToolResult> {
  const handler = HANDLERS[name];
  if (!handler) {
    return {
      ok: false,
      changedFiles: [],
      summary: '',
      invariantErrors: [`Unknown domain tool: ${name}`],
    };
  }
  return handler(ctx, params);
}

export function skillToDomainTool(skill: string): DomainToolName | null {
  if (skill === 'custom_code_edit') return null;
  return (SKILL_TO_DOMAIN_TOOL[skill] as DomainToolName | undefined) ?? null;
}
