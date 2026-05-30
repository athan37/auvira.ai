import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import type { WebsiteEditAgentOptions } from '@/lib/project-workspace/website-edit-agent/types';

/** Domain tool names exposed to V3 planner/executor. */
export const DOMAIN_TOOL_NAMES = [
  'get_site_model',
  'find_section',
  'update_copy_field',
  'update_contact_info',
  'update_section_list',
  'apply_section_background',
  'update_theme',
  'add_section',
  'remove_section',
  'reorder_sections',
  'replace_image',
  'verify_source_invariants',
  'summarize_actual_changes',
] as const;

export type DomainToolName = (typeof DOMAIN_TOOL_NAMES)[number];

export interface DomainToolResult {
  ok: boolean;
  changedFiles: string[];
  summary: string;
  invariantErrors?: string[];
  /** Parsed values for verification / summary. */
  evidence?: Record<string, string>;
}

export interface DomainToolContext {
  editContext: EditContext;
  agentOptions: WebsiteEditAgentOptions;
  /** Files changed during this plan execution. */
  changedFiles: string[];
  beforeFiles: Record<string, string>;
  afterFiles: Record<string, string>;
}

export type DomainToolHandler = (
  ctx: DomainToolContext,
  params: Record<string, unknown>
) => Promise<DomainToolResult>;

export interface DomainToolParams {
  find_section?: { query?: string };
  apply_section_background?: {
    sectionIndex: number;
    backgroundClass?: string;
    backgroundColor?: string;
    sectionType?: string;
    title?: string;
    rendererComponent?: string;
  };
  update_contact_info?: { field: 'phone' | 'email' | 'address'; value: string };
  update_copy_field?: {
    scope: 'hero' | 'section';
    field: string;
    value: string;
    sectionIndex?: number;
  };
  update_section_list?: {
    action: 'add_service';
    title: string;
    description?: string;
  };
  add_section?: { type?: string; title: string; body?: string };
  update_theme?: { scope?: string; color?: string };
  replace_image?: { path?: string; url?: string };
  verify_source_invariants?: { checks?: unknown[] };
  summarize_actual_changes?: Record<string, never>;
}
