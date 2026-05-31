import { searchCodeTool } from './tools/searchCode';
import {
  extractSectionComponentSource,
  findSectionObjectRanges,
  type EnrichedSiteStructureSnapshot,
} from './resolveSectionTarget';
import type { CodeContextBlock, SectionTargetResult, ToolContext } from './types';

const SITE_CONFIG = 'src/lib/siteConfig.ts';
const PAGE_TSX = 'src/app/page.tsx';
const MAX_TOTAL_CHARS = 18_000;

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function sliceWithLines(
  content: string,
  start: number,
  end: number,
  path: string,
  label: string
): CodeContextBlock {
  const slice = content.slice(start, end);
  return {
    path,
    startLine: lineNumberAt(content, start),
    endLine: lineNumberAt(content, Math.max(start, end - 1)),
    label,
    content: slice,
  };
}

/** Extract siteConfig.sections[i] object with line numbers. */
export function extractSiteConfigSectionBlock(
  siteConfigContent: string,
  sectionIndex: number
): CodeContextBlock | null {
  const ranges = findSectionObjectRanges(siteConfigContent);
  const range = ranges[sectionIndex];
  if (!range) return null;

  const lines = siteConfigContent.split('\n');
  const slice = lines.slice(range.startLine - 1, range.endLine).join('\n');

  return {
    path: SITE_CONFIG,
    startLine: range.startLine,
    endLine: range.endLine,
    label: `siteConfig.sections[${sectionIndex}]`,
    content: slice,
  };
}

/** Extract page.tsx section component function block. */
export function extractPageSectionBlock(
  pageContent: string,
  componentName: string
): CodeContextBlock | null {
  const extracted = extractSectionComponentSource(pageContent, componentName);
  if (!extracted) return null;

  const start = pageContent.indexOf(extracted.content);
  if (start < 0) return null;

  return sliceWithLines(
    pageContent,
    start,
    start + extracted.content.length,
    PAGE_TSX,
    componentName
  );
}

/** Extract SectionRenderer switch case for a section type. */
export function extractSectionRendererCase(
  pageContent: string,
  sectionType: string
): CodeContextBlock | null {
  const re = new RegExp(
    `case\\s*['"]${sectionType}['"]\\s*:[^\\n]*(?:\\n[^\\n]*)?`,
    'i'
  );
  const match = pageContent.match(re);
  if (!match || match.index == null) return null;

  const start = match.index;
  const end = start + match[0].length;
  return sliceWithLines(
    pageContent,
    start,
    end,
    PAGE_TSX,
    `SectionRenderer case "${sectionType}"`
  );
}

function trimBlocksToBudget(blocks: CodeContextBlock[]): CodeContextBlock[] {
  const out: CodeContextBlock[] = [];
  let total = 0;

  for (const block of blocks) {
    const header = `### ${block.label} (${block.path}:${block.startLine}-${block.endLine})\n`;
    if (total + header.length + block.content.length > MAX_TOTAL_CHARS) {
      const remaining = MAX_TOTAL_CHARS - total - header.length - 40;
      if (remaining > 200) {
        out.push({
          ...block,
          content: `${block.content.slice(0, remaining)}\n/* … truncated … */`,
        });
      }
      break;
    }
    out.push(block);
    total += header.length + block.content.length;
  }

  return out;
}

async function grepAnchors(
  ctx: ToolContext,
  queries: string[],
  fileGlob?: string
): Promise<CodeContextBlock[]> {
  const blocks: CodeContextBlock[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    if (!query.trim()) continue;
    try {
      const result = await searchCodeTool({ query, file_glob: fileGlob }, ctx);
      if (!result.ok || !Array.isArray(result.matches)) continue;

      for (const m of result.matches as Array<{ path: string; line: number; content: string }>) {
        const key = `${m.path}:${m.line}`;
        if (seen.has(key)) continue;
        seen.add(key);

        let fileContent = ctx.beforeFiles[m.path];
        if (!fileContent) {
          try {
            const readResult = await import('./tools/readFile').then((mod) =>
              mod.readFileTool({ path: m.path }, ctx)
            );
            if (readResult.ok && typeof readResult.content === 'string') {
              fileContent = readResult.content;
            }
          } catch {
            blocks.push({
              path: m.path,
              startLine: m.line,
              endLine: m.line,
              label: `grep: ${query}`,
              content: m.content,
            });
            continue;
          }
        }

        if (fileContent) {
          const lines = fileContent.split('\n');
          const start = Math.max(0, m.line - 3);
          const end = Math.min(lines.length, m.line + 2);
          const slice = lines.slice(start, end).join('\n');
          blocks.push({
            path: m.path,
            startLine: start + 1,
            endLine: end,
            label: `grep: ${query}`,
            content: slice,
          });
        }
      }
    } catch {
      /* rg unavailable */
    }
  }

  return blocks;
}

export interface ExtractEditCodeContextInput {
  target: SectionTargetResult;
  siteConfigContent: string;
  pageContent: string;
  snapshot: EnrichedSiteStructureSnapshot;
  workspacePath: string;
  mode: 'gitlab';
  ownerMessage: string;
}

/**
 * Build targeted code context blocks for the resolved edit target.
 */
export async function extractEditCodeContext(
  input: ExtractEditCodeContextInput
): Promise<CodeContextBlock[]> {
  const { target, siteConfigContent, pageContent, snapshot, workspacePath, mode, ownerMessage } =
    input;

  const blocks: CodeContextBlock[] = [];

  if (target.kind === 'section' && target.sectionIndex != null) {
    const configBlock = extractSiteConfigSectionBlock(siteConfigContent, target.sectionIndex);
    if (configBlock) blocks.push(configBlock);

    const section = snapshot.sections[target.sectionIndex];
    const componentName = target.rendererComponent ?? section?.rendererComponent;
    if (componentName) {
      const pageBlock = extractPageSectionBlock(pageContent, componentName);
      if (pageBlock) blocks.push(pageBlock);
    }

    if (target.sectionType) {
      const caseBlock = extractSectionRendererCase(pageContent, target.sectionType);
      if (caseBlock) blocks.push(caseBlock);
    }
  } else if (target.kind === 'hero') {
    const heroBlock = extractPageSectionBlock(pageContent, 'Hero');
    if (heroBlock) blocks.push(heroBlock);
  } else if (target.kind === 'nav') {
    const navBlock = extractPageSectionBlock(pageContent, 'Nav');
    if (navBlock) blocks.push(navBlock);
  } else if (target.kind === 'footer') {
    const footerBlock = extractPageSectionBlock(pageContent, 'Footer');
    if (footerBlock) blocks.push(footerBlock);
  }

  const ctx: ToolContext = {
    workspacePath,
    mode,
    ownerMessage,
    changedFiles: [],
    beforeFiles: {
      [SITE_CONFIG]: siteConfigContent,
      [PAGE_TSX]: pageContent,
    },
    afterFiles: {},
    recordChange: () => {},
  };

  const grepQueries: string[] = [];
  if (target.title) {
    grepQueries.push(target.title);
  }
  if (target.sectionType) {
    grepQueries.push(`case "${target.sectionType}"`);
  }
  grepQueries.push('preset.card', 'preset.pageBg', 'preset.surfaceBg', 'preset.mutedBg');

  const grepBlocks = await grepAnchors(ctx, grepQueries, '*.{tsx,ts,css}');
  blocks.push(...grepBlocks.slice(0, 6));

  return trimBlocksToBudget(blocks);
}

/** Format code blocks for LLM prompts. */
export function formatCodeContextBlocks(blocks: CodeContextBlock[]): string {
  if (blocks.length === 0) return '(no extracted code blocks)';

  return blocks
    .map(
      (b) =>
        `### ${b.label} (${b.path}:${b.startLine}-${b.endLine})\n\`\`\`\n${b.content}\n\`\`\``
    )
    .join('\n\n');
}
