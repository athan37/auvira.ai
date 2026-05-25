import { promises as fs } from 'fs';
import path from 'path';
import { patchRemoveBanner, readSiteConfigFromWorkspace, SITE_CONFIG_REL } from '../siteConfigParser';
import type { ProposedChange } from '../types';

export async function applyRemoveExpiredBanner(
  workspacePath: string,
  payload: { bannerText: string }
): Promise<string[]> {
  const { content, relPath } = await readSiteConfigFromWorkspace(workspacePath);
  if (!content) throw new Error('siteConfig.ts not found');
  await fs.writeFile(
    path.join(workspacePath, relPath),
    patchRemoveBanner(content, payload.bannerText),
    'utf-8'
  );
  return [SITE_CONFIG_REL];
}

export function buildRemoveExpiredBannerChange(bannerText: string): ProposedChange {
  return {
    patchType: 'remove_expired_banner',
    targetFiles: [SITE_CONFIG_REL],
    payload: { bannerText },
  };
}
