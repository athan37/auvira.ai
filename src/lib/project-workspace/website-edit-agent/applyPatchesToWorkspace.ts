import { promises as fs } from 'fs';
import path from 'path';
import { isSafeWritePath } from '../workspaceEditShared';
import type { WebsiteEditAgentOptions } from './types';

export interface FilePatch {
  path: string;
  content?: string;
  find?: string;
  replace?: string;
}

/**
 * Apply structured patches to workspace files (L1/L2 edit responses).
 */
export async function applyPatchesToWorkspace(
  options: WebsiteEditAgentOptions,
  patches: FilePatch[]
): Promise<string[]> {
  const written: string[] = [];

  for (const patch of patches) {
    const normalized = patch.path.replace(/^\/+/, '');
    if (!isSafeWritePath(normalized)) continue;

    let nextContent: string | null = null;

    if (patch.content != null) {
      nextContent = patch.content;
    } else if (patch.find != null && patch.replace != null) {
      try {
        const current = options.gateway
          ? await options.gateway.readFile(normalized)
          : await fs.readFile(path.join(options.workspacePath, normalized), 'utf-8');
        if (!current.includes(patch.find)) continue;
        nextContent = current.replace(patch.find, patch.replace);
      } catch {
        continue;
      }
    }

    if (nextContent == null) continue;

    if (options.gateway) {
      await options.gateway.writeFile(normalized, nextContent);
    } else {
      const dest = path.join(options.workspacePath, normalized);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, nextContent, 'utf-8');
    }
    written.push(normalized);
  }

  return written;
}
