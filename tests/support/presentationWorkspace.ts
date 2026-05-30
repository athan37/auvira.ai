import path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import {
  buildSyntheticPageSource,
  buildSyntheticSiteConfigSource,
  createSyntheticWorkspace,
  defaultMultiSectionSiteSpec,
} from './syntheticSiteWorkspace';

/** @deprecated Use readSyntheticFile from syntheticSiteWorkspace */
export async function readWorkspaceSiteConfig(workspacePath: string): Promise<string> {
  return fs.readFile(path.join(workspacePath, 'src/lib/siteConfig.ts'), 'utf-8');
}

/** @deprecated Use readSyntheticFile from syntheticSiteWorkspace */
export async function readWorkspacePage(workspacePath: string): Promise<string> {
  return fs.readFile(path.join(workspacePath, 'src/app/page.tsx'), 'utf-8');
}

export async function cleanupPresentationWorkspace(workspacePath: string): Promise<void> {
  await fs.rm(workspacePath, { recursive: true, force: true });
}

/** Back-compat aliases for tests that import SITE_CONFIG_SOURCE / PAGE_SOURCE */
const _legacySpec = defaultMultiSectionSiteSpec();
export const SITE_CONFIG_SOURCE = buildSyntheticSiteConfigSource(_legacySpec);
export const PAGE_SOURCE = buildSyntheticPageSource(_legacySpec, 'wired');

/** Scratch workspace with generic multi-section site (wired renderers). */
export async function createPresentationTestWorkspace(): Promise<string> {
  const id = randomUUID().slice(0, 8);
  return createSyntheticWorkspace({
    site: defaultMultiSectionSiteSpec(),
    pageMode: 'wired',
    tailwind: 'canonical',
    workspaceId: `presentation-llm-${id}`,
  });
}
