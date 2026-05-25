import { promises as fs } from 'fs';
import path from 'path';
import { patchSiteConfigPhone, readSiteConfigFromWorkspace, SITE_CONFIG_REL } from '../siteConfigParser';
import type { ProposedChange } from '../types';

export async function applyRestorePhone(workspacePath: string, payload: { phone: string }): Promise<string[]> {
  const { content, relPath } = await readSiteConfigFromWorkspace(workspacePath);
  if (!content) throw new Error('siteConfig.ts not found');
  await fs.writeFile(path.join(workspacePath, relPath), patchSiteConfigPhone(content, payload.phone), 'utf-8');
  return [SITE_CONFIG_REL];
}

export function buildRestorePhoneChange(phone: string): ProposedChange {
  return { patchType: 'restore_phone', targetFiles: [SITE_CONFIG_REL], payload: { phone } };
}
