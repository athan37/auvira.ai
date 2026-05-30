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
import { getSiteModelTool, replaceImageTool, updateThemeTool } from './updateTheme';
import { verifySourceInvariantsTool } from './verifySourceInvariants';
import type { DomainToolContext, DomainToolHandler, DomainToolName, DomainToolResult } from './types';

const HANDLERS: Record<DomainToolName, DomainToolHandler> = {
  get_site_model: (ctx) => getSiteModelTool(ctx),
  find_section: findSectionTool,
  update_copy_field: updateCopyFieldTool,
  update_contact_info: updateContactInfoTool,
  update_section_list: updateSectionListTool,
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
  update_theme: 'update_theme',
  update_section_style: 'apply_section_background',
  add_section: 'add_section',
  add_service: 'update_section_list',
  remove_section: 'update_section_list',
  reorder_sections: 'update_section_list',
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
    const field =
      (merged.field as string) ??
      (/\bphone\b/i.test(editContext.effectiveMessage)
        ? 'phone'
        : /\bemail\b/i.test(editContext.effectiveMessage)
          ? 'email'
          : /\baddress\b/i.test(editContext.effectiveMessage)
            ? 'address'
            : 'phone');
    return { field, value: merged.value ?? merged[field] ?? merged.phone ?? merged.email };
  }

  if (skill === 'update_hero') {
    const field = (merged.field as string) ?? 'headline';
    return {
      scope: 'hero',
      field,
      value: merged.value ?? merged[field] ?? merged.headline,
    };
  }

  if (skill === 'update_section_copy') {
    const field = (merged.field as string) ?? 'title';
    return {
      scope: 'section',
      field,
      sectionIndex:
        typeof merged.sectionIndex === 'number'
          ? merged.sectionIndex
          : editContext.target.sectionIndex,
      value: merged.value ?? merged[field],
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
      sectionType: merged.sectionType ?? editContext.target.sectionType,
      title: merged.title ?? editContext.target.title,
      rendererComponent: merged.rendererComponent ?? editContext.target.rendererComponent,
      ...(merged.presentation && typeof merged.presentation === 'object'
        ? (merged.presentation as Record<string, unknown>)
        : {}),
    };
  }

  if (skill === 'add_service') {
    return {
      action: 'add_service',
      title: merged.title,
      description: merged.description,
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
