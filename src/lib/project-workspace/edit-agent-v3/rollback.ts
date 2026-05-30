import {
  captureEditRunSnapshot,
  rollbackEditRun,
  type EditRunSnapshot,
} from '@/lib/project-workspace/website-edit-agent-v2/lifecycle';
import type { WebsiteEditAgentOptions } from '@/lib/project-workspace/website-edit-agent/types';

export { captureEditRunSnapshot, rollbackEditRun };
export type { EditRunSnapshot };

/**
 * Roll back changed files from a captured snapshot.
 */
export async function rollbackChangedFiles(
  options: WebsiteEditAgentOptions,
  snapshot: EditRunSnapshot,
  changedFiles: string[]
): Promise<string[]> {
  return rollbackEditRun(options, snapshot, changedFiles);
}
