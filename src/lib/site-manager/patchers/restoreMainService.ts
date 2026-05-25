import { promises as fs } from 'fs';
import path from 'path';
import { patchSiteConfigMainService, readSiteConfigFromWorkspace, SITE_CONFIG_REL } from '../siteConfigParser';
import type { ProposedChange } from '../types';

export async function applyRestoreMainService(
  workspacePath: string,
  payload: { service: string }
): Promise<string[]> {
  const { content, relPath } = await readSiteConfigFromWorkspace(workspacePath);
  if (!content) throw new Error('siteConfig.ts not found');
  await fs.writeFile(
    path.join(workspacePath, relPath),
    patchSiteConfigMainService(content, payload.service),
    'utf-8'
  );
  return [SITE_CONFIG_REL];
}

export function buildRestoreMainServiceChange(service: string): ProposedChange {
  return { patchType: 'restore_main_service', targetFiles: [SITE_CONFIG_REL], payload: { service } };
}
