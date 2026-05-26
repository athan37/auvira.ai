import { promises as fs } from 'fs';
import path from 'path';
import {
  computeWorkspaceHashes,
  getChangedFilesFromHashes,
} from '../workspaceEditShared';
import type {
  EditStrategyId,
  EditTier,
  EditJobConfidence,
  WebsiteEditAgentOptions,
  WebsiteEditAgentResult,
} from './types';

export const PAGE_TSX = 'src/app/page.tsx';
export const GLOBALS_CSS = 'src/app/globals.css';
export const SITE_CONFIG = 'src/lib/siteConfig.ts';
export const LAYOUT_TSX = 'src/app/layout.tsx';
export const STATIC_INDEX = 'index.html';
export const STATIC_SITE_JSON = 'site.json';
export const STATIC_STYLES = 'styles.css';

/** Read a workspace-relative file. */
export async function readWorkspaceRel(
  options: WebsiteEditAgentOptions,
  rel: string
): Promise<string | null> {
  try {
    if (options.gateway) {
      return await options.gateway.readFile(rel);
    }
    return await fs.readFile(path.join(options.workspacePath, rel), 'utf-8');
  } catch {
    return null;
  }
}

/** Write a workspace-relative file. */
export async function writeWorkspaceRel(
  options: WebsiteEditAgentOptions,
  rel: string,
  content: string
): Promise<void> {
  if (options.gateway) {
    await options.gateway.writeFile(rel, content);
    return;
  }
  const dest = path.join(options.workspacePath, rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, content, 'utf-8');
}

/** Build a successful strategy result with changed file paths. */
export async function buildStrategyResult(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>,
  strategyId: EditStrategyId,
  tier: EditTier,
  summary: string,
  meta?: { confidence?: EditJobConfidence }
): Promise<WebsiteEditAgentResult | null> {
  const afterHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);
  const changedFiles = getChangedFilesFromHashes(beforeHashes, afterHashes);
  if (changedFiles.length === 0) {
    return null;
  }
  return {
    ok: true,
    strategy: strategyId,
    tier,
    confidence: meta?.confidence,
    summary,
    ownerMessage: summary,
    changedFiles,
  };
}
