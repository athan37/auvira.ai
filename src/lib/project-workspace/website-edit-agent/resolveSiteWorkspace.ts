import { promises as fs } from 'fs';
import path from 'path';
import type { WorkspaceGateway } from '../workspaceGateway';
import type { WorkspaceMode } from './types';

export type PageArchetype = 'section_loop' | 'section_config_only' | 'hardcoded' | 'static_html';

export interface SiteWorkspaceSnapshot {
  mode: WorkspaceMode;
  archetype: PageArchetype;
  siteConfigPath: string | null;
  pagePath: string | null;
  indexHtmlPath: string | null;
  siteJsonPath: string | null;
  stylesPath: string | null;
  siteConfigContent: string | null;
  pageContent: string | null;
  indexHtmlContent: string | null;
  siteJsonContent: string | null;
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

const STATIC_INDEX = 'index.html';
const STATIC_SITE_JSON = 'site.json';
const STATIC_STYLES = 'styles.css';

/**
 * Classify homepage structure from file contents (no I/O).
 */
export function detectPageArchetype(
  mode: WorkspaceMode,
  pageContent: string | null,
  siteConfigContent: string | null
): PageArchetype {
  if (mode === 'static') {
    return 'static_html';
  }
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
  mode: WorkspaceMode;
  gateway?: WorkspaceGateway;
}

/**
 * Resolve entry files and page archetype for image placement and verification.
 */
export async function resolveSiteWorkspace(
  input: ResolveSiteWorkspaceInput
): Promise<SiteWorkspaceSnapshot> {
  const { workspacePath, mode, gateway } = input;

  if (mode === 'static') {
    const indexHtmlPath = (await pathReadable(workspacePath, STATIC_INDEX, gateway))
      ? STATIC_INDEX
      : null;
    const siteJsonPath = (await pathReadable(workspacePath, STATIC_SITE_JSON, gateway))
      ? STATIC_SITE_JSON
      : null;
    const stylesPath = (await pathReadable(workspacePath, STATIC_STYLES, gateway))
      ? STATIC_STYLES
      : null;
    const indexHtmlContent = await readRel(workspacePath, indexHtmlPath, gateway);
    const siteJsonContent = await readRel(workspacePath, siteJsonPath, gateway);

    return {
      mode,
      archetype: 'static_html',
      siteConfigPath: null,
      pagePath: null,
      indexHtmlPath,
      siteJsonPath,
      stylesPath,
      siteConfigContent: null,
      pageContent: null,
      indexHtmlContent,
      siteJsonContent,
    };
  }

  const siteConfigPath = await resolveFirstPath(
    workspacePath,
    NEXT_SITE_CONFIG_CANDIDATES,
    gateway
  );
  const pagePath = await resolveFirstPath(workspacePath, NEXT_PAGE_CANDIDATES, gateway);
  const siteConfigContent = await readRel(workspacePath, siteConfigPath, gateway);
  const pageContent = await readRel(workspacePath, pagePath, gateway);
  const archetype = detectPageArchetype(mode, pageContent, siteConfigContent);

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
