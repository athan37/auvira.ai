import { promises as fs } from 'fs';
import path from 'path';
import {
  computeWorkspaceHashes,
  getChangedFilesFromHashes,
} from '../workspaceEditShared';
import { applyImagePlacementToSiteConfig, describePlacementForOwner } from './applyImagePlacementPlan';
import { planImagePlacement } from './imagePlacementPlan';
import {
  applyUniversalImageRenderer,
  genericSectionRendersItemImages,
  pageHasGalleryRenderer,
  stampPageForGalleryPreviewReload,
} from './universalImageRenderer';
import { repairPageTsxStructure } from '../repairPageTsxStructure';
import { isValidTsxSource } from '../validateTsxSyntax';
import { resolveSiteWorkspace } from './resolveSiteWorkspace';
import { verifyEditApplied } from './verifyEditApplied';
import { stampSiteConfigForGalleryPreviewReload } from './gallerySiteConfig';
import { validateGalleryInSiteConfigSource } from './validateGallerySiteConfig';
import {
  describeSiteConfigParseFailure,
  parseSiteConfigSource,
} from '@/lib/site-manager/siteConfigParser';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from './types';

/**
 * Next.js image upload pipeline: plan placement → siteConfig → universal page renderer.
 */
export async function runImageGallerySectionStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  const attachments = options.attachments ?? [];
  if (attachments.length === 0 || options.mode !== 'gitlab') {
    return null;
  }

  const workspace = await resolveSiteWorkspace({
    workspacePath: options.workspacePath,
    mode: options.mode,
    gateway: options.gateway,
  });

  const siteConfigPath = workspace.siteConfigPath;
  const pagePath = workspace.pagePath;
  const siteConfigContent = workspace.siteConfigContent;
  const pageBefore = workspace.pageContent;

  if (!siteConfigPath || !pagePath || !siteConfigContent || !pageBefore) {
    return null;
  }

  async function readRel(rel: string): Promise<string | null> {
    try {
      return options.gateway
        ? await options.gateway.readFile(rel)
        : await fs.readFile(path.join(options.workspacePath, rel), 'utf-8');
    } catch {
      return null;
    }
  }

  async function writeRel(rel: string, content: string): Promise<void> {
    if (options.gateway) {
      await options.gateway.writeFile(rel, content);
    } else {
      const dest = path.join(options.workspacePath, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, content, 'utf-8');
    }
  }

  if (!parseSiteConfigSource(siteConfigContent)) {
    return {
      ok: false,
      strategy: 'image_gallery',
      error: describeSiteConfigParseFailure(siteConfigContent),
      ownerMessage:
        'Your site configuration file could not be read. Please contact support or try a simpler edit.',
    };
  }

  const { plan, snapshot, usedLlm } = await planImagePlacement({
    ownerMessage: options.ownerMessage,
    attachments,
    siteConfigContent,
    pageContent: pageBefore,
  });

  let updatedSiteConfig: string;
  try {
    updatedSiteConfig = applyImagePlacementToSiteConfig(
      siteConfigContent,
      plan,
      attachments,
      snapshot,
      options.ownerMessage
    );
  } catch (placementErr) {
    const msg =
      placementErr instanceof Error ? placementErr.message : String(placementErr);
    return {
      ok: false,
      strategy: 'image_gallery',
      error: msg,
      ownerMessage:
        'Images were uploaded but could not be placed in your site configuration. Please try again.',
    };
  }

  if (!parseSiteConfigSource(updatedSiteConfig)) {
    return {
      ok: false,
      strategy: 'image_gallery',
      error: 'siteConfig.ts format not supported after placement',
      ownerMessage:
        'Images were uploaded but could not be linked into a gallery section. Please try again.',
    };
  }

  const beforeFiles: Record<string, string> = {
    [siteConfigPath]: siteConfigContent,
    [pagePath]: pageBefore,
  };

  const stampedConfig = stampSiteConfigForGalleryPreviewReload(updatedSiteConfig);
  await writeRel(siteConfigPath, stampedConfig);

  const afterWriteConfig = (await readRel(siteConfigPath)) ?? '';
  const galleryCheck = validateGalleryInSiteConfigSource(afterWriteConfig, attachments);
  if (!galleryCheck.ok) {
    return {
      ok: false,
      strategy: 'image_gallery',
      error: galleryCheck.reason,
      ownerMessage:
        'Images were uploaded but could not be linked into a gallery section. Please try again.',
    };
  }

  let pageAfter = pageBefore;
  let renderPatch = applyUniversalImageRenderer(pageBefore, workspace.archetype);
  if (renderPatch.patched && isValidTsxSource(renderPatch.content, 'page.tsx')) {
    pageAfter = renderPatch.content;
  } else if (
    !pageHasGalleryRenderer(pageAfter) &&
    !genericSectionRendersItemImages(pageAfter)
  ) {
    const structural = repairPageTsxStructure(pageAfter);
    renderPatch = applyUniversalImageRenderer(structural.content, workspace.archetype);
    if (renderPatch.patched && isValidTsxSource(renderPatch.content, 'page.tsx')) {
      pageAfter = renderPatch.content;
    }
  } else if (
    pageHasGalleryRenderer(pageAfter) &&
    !/case\s*['"]gallery['"]/.test(pageAfter)
  ) {
    renderPatch = applyUniversalImageRenderer(pageAfter, workspace.archetype);
    if (renderPatch.patched && isValidTsxSource(renderPatch.content, 'page.tsx')) {
      pageAfter = renderPatch.content;
    }
  }

  if (!pageHasGalleryRenderer(pageAfter) && !genericSectionRendersItemImages(pageAfter)) {
    return {
      ok: false,
      strategy: 'image_gallery',
      error: `page does not render gallery images (archetype=${workspace.archetype}, anchors=${renderPatch.anchors.join(',') || 'none'})`,
      ownerMessage:
        "Your images were saved, but this site's page template still can't display them. Please try again after the latest deploy.",
    };
  }

  const stamped = stampPageForGalleryPreviewReload(pageAfter);
  await writeRel(pagePath, stamped);
  pageAfter = stamped;

  const afterSiteConfig = (await readRel(siteConfigPath)) ?? updatedSiteConfig;
  const afterFiles: Record<string, string> = {
    [siteConfigPath]: afterSiteConfig,
    [pagePath]: pageAfter,
  };

  const verification = verifyEditApplied(options.ownerMessage, beforeFiles, afterFiles);
  if (!verification.ok) {
    return {
      ok: false,
      strategy: 'image_gallery',
      error: verification.reason,
      ownerMessage: "I couldn't safely apply that section. Please try rephrasing your request.",
    };
  }

  const afterHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);
  const changedFiles = getChangedFilesFromHashes(beforeHashes, afterHashes);
  if (changedFiles.length === 0) {
    return null;
  }

  const hasHardcodedHero =
    pageBefore.includes('function Hero') || /"hero"\s*:/.test(siteConfigContent);
  const targetTitle =
    plan.targetSectionTitle ||
    snapshot.sections[plan.targetSectionIndex ?? -1]?.title ||
    plan.title;
  const ownerMessage = describePlacementForOwner(plan, attachments.length, {
    hasHardcodedHero,
    sectionTitle: targetTitle,
  });
  const summary = usedLlm
    ? `${ownerMessage} (placement chosen from your site layout.)`
    : `${ownerMessage} (placement chosen by site structure rules.)`;

  return {
    ok: true,
    strategy: 'image_gallery',
    summary,
    ownerMessage: summary,
    changedFiles,
  };
}
