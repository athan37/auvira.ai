import { promises as fs } from 'fs';
import path from 'path';
import {
  ensureSiteConfigTypesSupportGallery,
  siteConfigNeedsGalleryTypeUpgrade,
} from '@/lib/builder/siteConfigTypes';

const SITE_CONFIG_DATA_NAV = /"navigation"\s*:\s*\[/;
const SITE_CONFIG_BLOCK_PATTERN = /export type SiteConfig\s*=\s*\{[\s\S]*?\n\};/;

function siteConfigNeedsNavigationTypeUpgrade(content: string): boolean {
  if (!SITE_CONFIG_DATA_NAV.test(content)) return false;
  const block = content.match(SITE_CONFIG_BLOCK_PATTERN)?.[0] || '';
  return !/navigation\??\s*:/.test(block);
}
import type { WorkspaceGateway } from '@/lib/project-workspace/workspaceGateway';

const SITE_CONFIG_REL = 'src/lib/siteConfig.ts';

/**
 * Fix SiteSection type union when gallery sections exist in siteConfig data.
 * Prevents `next build` failure: Type '"gallery"' is not assignable to type SiteSection.type.
 */
export function repairSiteConfigTypesContent(content: string): {
  content: string;
  repaired: boolean;
} {
  if (!siteConfigNeedsGalleryTypeUpgrade(content) && !siteConfigNeedsNavigationTypeUpgrade(content)) {
    return { content, repaired: false };
  }
  const next = ensureSiteConfigTypesSupportGallery(content);
  return { content: next, repaired: next !== content };
}

/** Repair siteConfig.ts on disk when gallery data outpaces the type union. */
export async function repairSiteConfigTypesInWorkspace(
  workspacePath: string
): Promise<boolean> {
  const configPath = path.join(workspacePath, SITE_CONFIG_REL);
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    const { content, repaired } = repairSiteConfigTypesContent(raw);
    if (repaired) {
      await fs.writeFile(configPath, content, 'utf-8');
    }
    return repaired;
  } catch {
    return false;
  }
}

/** Repair siteConfig.ts inside a sandbox or gateway-backed workspace. */
export async function repairSiteConfigTypesViaGateway(
  gateway: WorkspaceGateway
): Promise<boolean> {
  try {
    const raw = await gateway.readFile(SITE_CONFIG_REL);
    const { content, repaired } = repairSiteConfigTypesContent(raw);
    if (repaired) {
      await gateway.writeFile(SITE_CONFIG_REL, content);
    }
    return repaired;
  } catch {
    return false;
  }
}
