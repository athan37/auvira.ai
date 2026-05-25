import { promises as fs } from 'fs';
import path from 'path';
import { getGitWorkspacePath } from '@/lib/project-workspace/gitWorkspaceManager';
import { buildProductsSection, type CatalogProductInput } from '@/lib/catalog/buildProductsSection';

import { SITE_CONFIG_TYPE_BLOCK } from '@/lib/builder/siteConfigTypes';

const SITE_CONFIG_HEADER = `// Site configuration - business content only
// This file is auto-generated. Edits will be overwritten.

${SITE_CONFIG_TYPE_BLOCK}

export const siteConfig: SiteConfig = `;

/**
 * Injects catalog products as a services-style section in workspace siteConfig.ts.
 */
export async function syncCatalogToWorkspace(
  projectId: string,
  products: CatalogProductInput[]
): Promise<{ updated: boolean }> {
  const workspacePath = getGitWorkspacePath(projectId);
  const configPath = path.join(workspacePath, 'src/lib/siteConfig.ts');

  let content: string;
  try {
    content = await fs.readFile(configPath, 'utf-8');
  } catch {
    throw new Error('Draft preview not ready yet. Open the editor and wait for preview to load.');
  }

  const match = content.match(/export const siteConfig:\s*SiteConfig\s*=\s*(\{[\s\S]*\});?\s*$/);
  if (!match) {
    throw new Error('Could not read site configuration from draft preview.');
  }

  const config = JSON.parse(match[1]) as {
    sections?: Array<{ type: string; title?: string; [key: string]: unknown }>;
    [key: string]: unknown;
  };

  const productSection = buildProductsSection(products);
  if (!productSection) {
    return { updated: false };
  }

  const sections = (config.sections || []).filter(
    (s) => s.title !== 'Our Products' && s.type !== 'products'
  );
  sections.push(productSection);
  config.sections = sections;

  const nextContent = `${SITE_CONFIG_HEADER}${JSON.stringify(config, null, 2)};\n`;
  await fs.writeFile(configPath, nextContent, 'utf-8');
  return { updated: true };
}
