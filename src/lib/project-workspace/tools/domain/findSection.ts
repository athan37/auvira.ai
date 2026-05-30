import { matchSectionFromMessage } from '@/lib/project-workspace/website-edit-agent/siteSectionCatalog';
import type { DomainToolContext, DomainToolResult } from './types';

/**
 * Find a section by owner query against the site catalog.
 */
export async function findSectionTool(
  ctx: DomainToolContext,
  params: Record<string, unknown>
): Promise<DomainToolResult> {
  const query = String(params.query ?? ctx.editContext.effectiveMessage);
  const match = matchSectionFromMessage(query, ctx.editContext.sectionCatalog, {
    history: ctx.editContext.conversationHistory,
  });

  if (!match || match.sectionIndex == null) {
    return {
      ok: false,
      changedFiles: [],
      summary: match?.clarificationMessage ?? 'Section not found',
      invariantErrors: [match?.clarificationMessage ?? 'Section not found'],
    };
  }

  return {
    ok: true,
    changedFiles: [],
    summary: `Found section [${match.sectionIndex}] "${match.title ?? ''}"`,
    evidence: {
      sectionIndex: String(match.sectionIndex),
      title: match.title ?? '',
      type: match.sectionType ?? '',
    },
  };
}
