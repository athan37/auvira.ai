import { promises as fs } from 'fs';
import path from 'path';
import { repairTailwindConfigInWorkspace } from '@/lib/builder/tailwindPresentationSupport';
import { repairSiteConfigTypesInWorkspace } from '@/lib/preview/repairSiteConfigTypes';
import { repairPageTsxStructure } from '@/lib/project-workspace/repairPageTsxStructure';

export interface PrepareGeneratedWorkspaceResult {
  /** Relative paths repaired under workspacePath. */
  repaired: string[];
}

/**
 * Apply auto-fixes to a generated site workspace before npm build (clone build gate).
 */
export async function prepareGeneratedWorkspaceForBuild(
  workspacePath: string
): Promise<PrepareGeneratedWorkspaceResult> {
  const repaired: string[] = [];

  if (await repairTailwindConfigInWorkspace(workspacePath)) {
    repaired.push('tailwind.config.js');
  }

  if (await repairSiteConfigTypesInWorkspace(workspacePath)) {
    repaired.push('src/lib/siteConfig.ts');
  }

  const pagePath = path.join(workspacePath, 'src/app/page.tsx');
  try {
    const before = await fs.readFile(pagePath, 'utf-8');
    const { content, repaired: pageRepaired } = repairPageTsxStructure(before);
    if (pageRepaired && content !== before) {
      await fs.writeFile(pagePath, content, 'utf-8');
      repaired.push('src/app/page.tsx');
    }
  } catch {
    // page.tsx may be absent in non-standard workspaces
  }

  return { repaired };
}
