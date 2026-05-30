import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { GeneratedFile } from '@/lib/builder/types';
import type { WorkspaceGateway } from '@/lib/project-workspace/workspaceGateway';
import {
  ANALYTICS_ATTRS_PATH,
  ANALYTICS_CONFIG_PATH,
  ANALYTICS_RUNTIME_PATH,
  PAGE_PATH,
  SITE_CONFIG_PATH,
  resolveAnalyticsCollectEndpoint,
} from './analyticsConstants';
import { ensureAnalyticsIdsInSiteConfig } from './ensureAnalyticsIds';
import {
  generateAnalyticsAttrsSource,
  generateAnalyticsConfigSource,
  generateWebsiteAnalyticsSource,
} from './analyticsSourceTemplates';
import {
  injectAnalyticsIntoPageSource,
  injectAnalyticsRuntimeFiles,
} from './injectAnalyticsRuntime';

export interface InstrumentGeneratedSiteOptions {
  publicSiteKey?: string;
  collectEndpoint?: string;
  enabled?: boolean;
}

export interface InstrumentGeneratedFilesResult {
  files: GeneratedFile[];
  publicSiteKey: string;
  changed: boolean;
}

export interface InstrumentGeneratedWorkspaceInput extends InstrumentGeneratedSiteOptions {
  workspacePath: string;
  gateway?: WorkspaceGateway;
}

export interface InstrumentGeneratedWorkspaceResult {
  publicSiteKey: string;
  changedFiles: string[];
}

export function createPublicAnalyticsSiteKey(): string {
  return `was_${crypto.randomBytes(18).toString('base64url')}`;
}

export function extractPublicSiteKeyFromAnalyticsConfigSource(content: string | null | undefined): string | null {
  if (!content) return null;
  const match = content.match(/publicSiteKey:\s*["']([^"']+)["']/);
  return match?.[1] ?? null;
}

function resolveSiteKey(options: InstrumentGeneratedSiteOptions, existingConfig?: string | null): string {
  return (
    options.publicSiteKey ||
    extractPublicSiteKeyFromAnalyticsConfigSource(existingConfig) ||
    createPublicAnalyticsSiteKey()
  );
}

function defaultEnabled(publicSiteKey: string, collectEndpoint: string, enabled?: boolean): boolean {
  return enabled ?? Boolean(publicSiteKey && collectEndpoint);
}

export function instrumentGeneratedFiles(
  files: GeneratedFile[],
  options: InstrumentGeneratedSiteOptions = {}
): InstrumentGeneratedFilesResult {
  const before = JSON.stringify(files);
  const existingConfig = files.find((file) => file.filePath === ANALYTICS_CONFIG_PATH)?.content;
  const publicSiteKey = resolveSiteKey(options, existingConfig);
  const collectEndpoint = options.collectEndpoint ?? resolveAnalyticsCollectEndpoint();
  const enabled = defaultEnabled(publicSiteKey, collectEndpoint, options.enabled);

  let next = files.map((file) => {
    if (file.filePath !== SITE_CONFIG_PATH) return file;
    const ensured = ensureAnalyticsIdsInSiteConfig(file.content);
    return ensured.changed ? { ...file, content: ensured.content } : file;
  });

  next = injectAnalyticsRuntimeFiles(next, { publicSiteKey, collectEndpoint, enabled });

  return {
    files: next,
    publicSiteKey,
    changed: JSON.stringify(next) !== before,
  };
}

async function readRel(input: InstrumentGeneratedWorkspaceInput, relPath: string): Promise<string | null> {
  try {
    if (input.gateway) return await input.gateway.readFile(relPath);
    return await fs.readFile(path.join(input.workspacePath, relPath), 'utf-8');
  } catch {
    return null;
  }
}

async function writeRel(
  input: InstrumentGeneratedWorkspaceInput,
  relPath: string,
  content: string
): Promise<void> {
  if (input.gateway) {
    await input.gateway.writeFile(relPath, content);
    return;
  }
  const fullPath = path.join(input.workspacePath, relPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf-8');
}

async function writeIfChanged(
  input: InstrumentGeneratedWorkspaceInput,
  relPath: string,
  content: string
): Promise<boolean> {
  const current = await readRel(input, relPath);
  if (current === content) return false;
  await writeRel(input, relPath, content);
  return true;
}

export async function instrumentGeneratedSite(
  input: InstrumentGeneratedWorkspaceInput
): Promise<InstrumentGeneratedWorkspaceResult> {
  const existingConfig = await readRel(input, ANALYTICS_CONFIG_PATH);
  const publicSiteKey = resolveSiteKey(input, existingConfig);
  const collectEndpoint = input.collectEndpoint ?? resolveAnalyticsCollectEndpoint();
  const enabled = defaultEnabled(publicSiteKey, collectEndpoint, input.enabled);
  const changedFiles: string[] = [];

  const siteConfig = await readRel(input, SITE_CONFIG_PATH);
  if (siteConfig) {
    const ensured = ensureAnalyticsIdsInSiteConfig(siteConfig);
    if (ensured.changed) {
      await writeRel(input, SITE_CONFIG_PATH, ensured.content);
      changedFiles.push(SITE_CONFIG_PATH);
    }
  }

  const page = await readRel(input, PAGE_PATH);
  if (page) {
    const updatedPage = injectAnalyticsIntoPageSource(page);
    if (updatedPage !== page) {
      await writeRel(input, PAGE_PATH, updatedPage);
      changedFiles.push(PAGE_PATH);
    }
  }

  const filesToEnsure: Array<[string, string]> = [
    [
      ANALYTICS_CONFIG_PATH,
      generateAnalyticsConfigSource({ publicSiteKey, collectEndpoint, enabled }),
    ],
    [ANALYTICS_ATTRS_PATH, generateAnalyticsAttrsSource()],
    [ANALYTICS_RUNTIME_PATH, generateWebsiteAnalyticsSource()],
  ];

  for (const [relPath, content] of filesToEnsure) {
    if (await writeIfChanged(input, relPath, content)) {
      changedFiles.push(relPath);
    }
  }

  return {
    publicSiteKey,
    changedFiles,
  };
}
