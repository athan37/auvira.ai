import { promises as fs } from 'fs';
import path from 'path';
import { patchSiteConfigHours, readSiteConfigFromWorkspace, SITE_CONFIG_REL } from '../siteConfigParser';
import type { ProposedChange } from '../types';

export async function applyRestoreHours(workspacePath: string, payload: { hours: string }): Promise<string[]> {
  const { content, relPath } = await readSiteConfigFromWorkspace(workspacePath);
  if (!content) throw new Error('siteConfig.ts not found');
  await fs.writeFile(path.join(workspacePath, relPath), patchSiteConfigHours(content, payload.hours), 'utf-8');
  return [SITE_CONFIG_REL];
}

export function buildRestoreHoursChange(hours: string): ProposedChange {
  return { patchType: 'restore_hours', targetFiles: [SITE_CONFIG_REL], payload: { hours } };
}
