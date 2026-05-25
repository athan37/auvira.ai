import { promises as fs } from 'fs';
import path from 'path';
import {
  computeWorkspaceHashes,
  getChangedFilesFromHashes,
} from '../workspaceEditShared';
import { parseSiteConfigSource, rebuildSiteConfigFile } from '@/lib/site-manager/siteConfigParser';
import { verifyEditApplied } from './verifyEditApplied';
import { resolveSiteWorkspace } from './resolveSiteWorkspace';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from './types';

/** Single-image upload aimed at hero, logo, or banner. */
export function isHeroImageRequest(message: string, attachmentCount: number): boolean {
  if (attachmentCount !== 1) return false;
  const lower = message.toLowerCase();
  return /\b(hero|logo|banner|header image|main photo|top of page|above the fold)\b/.test(lower);
}

function patchHeroInPage(pageContent: string, imageUrl: string): { content: string; patched: boolean } {
  if (pageContent.includes(imageUrl)) {
    return { content: pageContent, patched: false };
  }

  if (/function Hero/.test(pageContent)) {
    const heroImg = `
        <div className="relative mt-8 overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
          <img src="${imageUrl}" alt="Hero" className="h-64 w-full object-cover md:h-80" />
        </div>`;
    const insertAfterSubheadline =
      /(\{hero\.subheadline && <p[^>]*>\{hero\.subheadline\}<\/p>\}\s*\n)(\s*<div className="mt-9)/;
    if (insertAfterSubheadline.test(pageContent)) {
      return {
        content: pageContent.replace(insertAfterSubheadline, `$1${heroImg}\n$2`),
        patched: true,
      };
    }
    const insertBeforeCta =
      /(function Hero[\s\S]*?)(\s*<div className="mt-9 flex flex-wrap gap-4">)/;
    if (insertBeforeCta.test(pageContent)) {
      return {
        content: pageContent.replace(insertBeforeCta, `$1${heroImg}\n$2`),
        patched: true,
      };
    }
  }

  return { content: pageContent, patched: false };
}

function patchHeroInSiteConfig(siteConfigContent: string, imageUrl: string): string {
  const parsed = parseSiteConfigSource(siteConfigContent);
  if (!parsed) return siteConfigContent;
  const config = parsed as ParsedSiteConfigWithHero;
  config.hero = config.hero ?? { headline: 'Welcome' };
  (config.hero as { imageUrl?: string }).imageUrl = imageUrl;
  return rebuildSiteConfigFile(siteConfigContent, config);
}

type ParsedSiteConfigWithHero = ReturnType<typeof parseSiteConfigSource> & {
  hero?: { headline?: string; imageUrl?: string };
};

/**
 * Apply a single uploaded image to the hero area (siteConfig + page.tsx).
 */
export async function runHeroImageStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  const attachments = options.attachments ?? [];
  if (options.mode !== 'gitlab' || attachments.length !== 1) {
    return null;
  }
  if (!isHeroImageRequest(options.ownerMessage, attachments.length)) {
    return null;
  }

  const workspace = await resolveSiteWorkspace({
    workspacePath: options.workspacePath,
    mode: options.mode,
    gateway: options.gateway,
  });
  if (!workspace.siteConfigPath || !workspace.pagePath || !workspace.siteConfigContent) {
    return null;
  }
  const pageBefore = workspace.pageContent;
  if (!pageBefore) return null;

  const imageUrl = attachments[0].publicUrl;
  const siteConfigPath = workspace.siteConfigPath;
  const pagePath = workspace.pagePath;
  const siteBefore = workspace.siteConfigContent;

  async function writeRel(rel: string, content: string): Promise<void> {
    if (options.gateway) {
      await options.gateway.writeFile(rel, content);
    } else {
      const dest = path.join(options.workspacePath, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, content, 'utf-8');
    }
  }

  const siteAfter = patchHeroInSiteConfig(siteBefore, imageUrl);
  const { content: pageAfter, patched: pagePatched } = patchHeroInPage(pageBefore, imageUrl);
  const finalPage = pagePatched ? pageAfter : pageBefore;

  if (!siteAfter.includes(imageUrl) && !finalPage.includes(imageUrl)) {
    return {
      ok: false,
      strategy: 'image_gallery',
      error: `hero patch failed (archetype=${workspace.archetype})`,
      ownerMessage: "Couldn't place that image in the hero. Try mentioning 'hero' or 'logo' again.",
    };
  }

  await writeRel(siteConfigPath, siteAfter);
  if (pagePatched) {
    await writeRel(pagePath, finalPage);
  }

  const beforeFiles: Record<string, string> = {
    [siteConfigPath]: siteBefore,
    [pagePath]: pageBefore,
  };
  const afterFiles: Record<string, string> = {
    [siteConfigPath]: siteAfter,
    [pagePath]: finalPage,
  };

  const verification = verifyEditApplied(options.ownerMessage, beforeFiles, afterFiles);
  if (!verification.ok) {
    return {
      ok: false,
      strategy: 'image_gallery',
      error: verification.reason,
      ownerMessage: "I couldn't safely apply that hero image. Please try rephrasing.",
    };
  }

  const afterHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);
  const changedFiles = getChangedFilesFromHashes(beforeHashes, afterHashes);
  if (changedFiles.length === 0) return null;

  return {
    ok: true,
    strategy: 'image_gallery',
    summary: 'Updated your hero with the uploaded image.',
    ownerMessage: 'Updated your hero with the uploaded image.',
    changedFiles,
  };
}
