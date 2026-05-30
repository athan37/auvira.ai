import {
  GLOBALS_CSS,
  PAGE_TSX,
  SITE_CONFIG,
  readWorkspaceRel,
  writeWorkspaceRel,
} from './website-edit-agent/strategyContext';
import type { WebsiteEditAgentOptions } from './website-edit-agent/types';

const SNAPSHOT_PATHS = [SITE_CONFIG, PAGE_TSX, GLOBALS_CSS] as const;

export interface EditRunSnapshot {
  files: Record<string, string>;
}

async function captureFiles(
  options: WebsiteEditAgentOptions,
  paths: readonly string[]
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const filePath of paths) {
    const content = await readWorkspaceRel(options, filePath);
    if (content !== null) {
      files[filePath] = content;
    }
  }
  return files;
}

/**
 * Capture pre-edit files needed for verification and rollback.
 */
export async function captureEditRunSnapshot(
  options: WebsiteEditAgentOptions
): Promise<EditRunSnapshot> {
  return { files: await captureFiles(options, SNAPSHOT_PATHS) };
}

/**
 * Restore pre-edit files when repair cannot produce a safe workspace.
 */
export async function rollbackEditRun(
  options: WebsiteEditAgentOptions,
  snapshot: EditRunSnapshot,
  changedFiles: string[]
): Promise<string[]> {
  const restored: string[] = [];
  for (const filePath of changedFiles) {
    const content = snapshot.files[filePath];
    if (content === undefined) continue;
    await writeWorkspaceRel(options, filePath, content);
    restored.push(filePath);
  }
  return restored;
}
