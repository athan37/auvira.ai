import {
  extractSiteConfigSectionBlock,
  extractPageSectionBlock,
} from '@/lib/project-workspace/website-edit-agent/extractEditCodeContext';
import type { EditContext, ContextSnippet } from './types';

const MAX_SNIPPET_CHARS = 12_000;

/**
 * Select bounded code snippets for planner / fallback context.
 */
export function selectRelevantContext(context: EditContext): ContextSnippet[] {
  const snippets: ContextSnippet[] = [];
  let totalChars = 0;

  const siteConfig = context.siteModel.siteConfigContent;
  const page = context.siteModel.pageContent;

  if (context.target.sectionIndex != null && siteConfig) {
    const block = extractSiteConfigSectionBlock(siteConfig, context.target.sectionIndex);
    if (block && totalChars + block.content.length <= MAX_SNIPPET_CHARS) {
      snippets.push(block);
      totalChars += block.content.length;
    }
  }

  if (context.target.rendererComponent && page) {
    const block = extractPageSectionBlock(page, context.target.rendererComponent);
    if (block && totalChars + block.content.length <= MAX_SNIPPET_CHARS) {
      snippets.push(block);
      totalChars += block.content.length;
    }
  }

  if (snippets.length === 0 && siteConfig) {
    const head = siteConfig.slice(0, Math.min(4000, siteConfig.length));
    snippets.push({
      path: 'src/lib/siteConfig.ts',
      startLine: 1,
      endLine: head.split('\n').length,
      label: 'siteConfig (head)',
      content: head,
    });
  }

  return snippets;
}
