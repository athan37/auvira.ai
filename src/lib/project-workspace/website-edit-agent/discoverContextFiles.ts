import { promises as fs } from 'fs';
import path from 'path';
import { searchCodeTool } from './tools/searchCode';
import { isSafeWritePath } from '../workspaceEditShared';
import type { ToolContext, WorkspaceMode } from './types';

export const PRIORITY_CONTEXT_FILES = [
  'src/app/globals.css',
  'src/app/page.tsx',
  'src/app/layout.tsx',
  'src/lib/siteConfig.ts',
];

export const STATIC_CONTEXT_FILES = ['index.html', 'styles.css', 'site.json'];

const MAX_FILE_BYTES = 12_000;
const MAX_DISCOVERED = 6;

/**
 * Discover files likely relevant to an owner edit (priority paths + search hits).
 */
export async function discoverContextFiles(
  workspacePath: string,
  mode: WorkspaceMode,
  ownerMessage: string
): Promise<string[]> {
  const candidates = new Set<string>();

  if (mode === 'static') {
    for (const f of STATIC_CONTEXT_FILES) {
      candidates.add(f);
    }
    return [...candidates];
  }

  for (const f of PRIORITY_CONTEXT_FILES) {
    candidates.add(f);
  }

  const keywords = ownerMessage
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  const ctx: ToolContext = {
    workspacePath,
    mode,
    ownerMessage,
    changedFiles: [],
    beforeFiles: {},
    afterFiles: {},
    recordChange: () => {},
  };

  for (const kw of keywords) {
    if (candidates.size >= PRIORITY_CONTEXT_FILES.length + MAX_DISCOVERED) break;
    try {
      const result = await searchCodeTool({ query: kw }, ctx);
      if (result.ok && Array.isArray(result.matches)) {
        for (const m of result.matches as Array<{ path: string }>) {
          if (m.path && isSafeWritePath(m.path)) {
            candidates.add(m.path);
          }
        }
      }
    } catch {
      /* rg unavailable */
    }
  }

  return [...candidates].slice(0, PRIORITY_CONTEXT_FILES.length + MAX_DISCOVERED);
}

/**
 * Load truncated file contents for prompt context.
 */
export async function loadContextFileContents(
  workspacePath: string,
  relativePaths: string[]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  for (const rel of relativePaths) {
    try {
      const content = await fs.readFile(path.join(workspacePath, rel), 'utf-8');
      if (content.length <= MAX_FILE_BYTES) {
        out[rel] = content;
      } else {
        out[rel] = `${content.slice(0, MAX_FILE_BYTES)}\n/* … truncated … */`;
      }
    } catch {
      /* missing */
    }
  }

  return out;
}
