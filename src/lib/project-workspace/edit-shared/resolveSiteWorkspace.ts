import { promises as fs } from 'fs';
import path from 'path';
import type { WorkspaceGateway } from '../workspaceGateway';
import type { WorkspaceMode } from './types';

export type PageArchetype = 'section_loop' | 'section_config_only' | 'hardcoded';

export interface SiteWorkspaceSnapshot {
  mode: WorkspaceMode;
  archetype: PageArchetype;
  siteConfigPath: string | null;
  pagePath: string | null;
  indexHtmlPath: null;
  siteJsonPath: null;
  stylesPath: null;
  siteConfigContent: string | null;
  pageContent: string | null;
  indexHtmlContent: null;
  siteJsonContent: null;
}

const NEXT_SITE_CONFIG_CANDIDATES = [
  'src/lib/siteConfig.ts',
  'lib/siteConfig.ts',
  'siteConfig.ts',
];

const NEXT_PAGE_CANDIDATES = [
  'src/app/page.tsx',
  'src/pages/index.tsx',
  'pages/index.tsx',
  'app/page.tsx',
  'page.tsx',
];

/**
 * Classify homepage structure from file contents (no I/O).
 */
export function detectPageArchetype(
  pageContent: string | null,
  siteConfigContent: string | null
): PageArchetype {
  const page = pageContent ?? '';
  const config = siteConfigContent ?? '';
  const hasSectionLoop =
    /siteConfig\.sections/.test(page) &&
    /\.map\s*\(/.test(page) &&
    (/SectionRenderer/.test(page) || /switch\s*\(\s*section\.type/.test(page));
  if (hasSectionLoop) {
    return 'section_loop';
  }
  const hasConfigRef =
    /from\s+['"]@?\/lib\/siteConfig['"]/.test(page) ||
    /from\s+['"].*siteConfig['"]/.test(page) ||
    /siteConfig\./.test(page);
  if (hasConfigRef || /sections\s*:/.test(config)) {
    return 'section_config_only';
  }
  return 'hardcoded';
}

async function pathReadable(
  workspacePath: string,
  rel: string,
  gateway?: WorkspaceGateway
): Promise<boolean> {
  if (gateway) {
    try {
      await gateway.readFile(rel);
      return true;
    } catch {
      return false;
    }
  }
  try {
    await fs.access(path.join(workspacePath, rel));
    return true;
  } catch {
    return false;
  }
}

async function resolveFirstPath(
  workspacePath: string,
  candidates: string[],
  gateway?: WorkspaceGateway
): Promise<string | null> {
  for (const rel of candidates) {
    if (await pathReadable(workspacePath, rel, gateway)) {
      return rel;
    }
  }
  return null;
}

async function readRel(
  workspacePath: string,
  rel: string | null,
  gateway?: WorkspaceGateway
): Promise<string | null> {
  if (!rel) return null;
  try {
    return gateway
      ? await gateway.readFile(rel)
      : await fs.readFile(path.join(workspacePath, rel), 'utf-8');
  } catch {
    return null;
  }
}

export interface ResolveSiteWorkspaceInput {
  workspacePath: string;
  mode?: WorkspaceMode;
  gateway?: WorkspaceGateway;
}

/**
 * Resolve entry files and page archetype for image placement and verification.
 */
export async function resolveSiteWorkspace(
  input: ResolveSiteWorkspaceInput
): Promise<SiteWorkspaceSnapshot> {
  const { workspacePath, gateway } = input;
  const mode: WorkspaceMode = 'gitlab';

  const siteConfigPath = await resolveFirstPath(
    workspacePath,
    NEXT_SITE_CONFIG_CANDIDATES,
    gateway
  );
  const pagePath = await resolveFirstPath(workspacePath, NEXT_PAGE_CANDIDATES, gateway);
  const siteConfigContent = await readRel(workspacePath, siteConfigPath, gateway);
  const pageContent = await readRel(workspacePath, pagePath, gateway);
  const archetype = detectPageArchetype(pageContent, siteConfigContent);

  return {
    mode,
    archetype,
    siteConfigPath,
    pagePath,
    indexHtmlPath: null,
    siteJsonPath: null,
    stylesPath: null,
    siteConfigContent,
    pageContent,
    indexHtmlContent: null,
    siteJsonContent: null,
  };
}
