import { promises as fs } from 'fs';
import path from 'path';
import {
  computeWorkspaceHashes,
  getChangedFilesFromHashes,
} from '../workspaceEditShared';
import { applyImagePlacementToSiteConfig, describePlacementForOwner } from './applyImagePlacementPlan';
import { planImagePlacement } from './imagePlacementPlan';
import { pageCanRenderGallerySection, patchPageForUploadedImages } from './patchGenericSectionImages';
import { verifyEditApplied } from './verifyEditApplied';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from './types';

const SITE_CONFIG = 'src/lib/siteConfig.ts';
const PAGE_TSX = 'src/app/page.tsx';

/**
 * Section + uploaded images: analyze site structure → plan placement → apply siteConfig + page patches.
 */
export async function runImageGallerySectionStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  const attachments = options.attachments ?? [];
  if (attachments.length === 0 || options.mode !== 'gitlab') {
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

  const siteConfigContent = await readRel(SITE_CONFIG);
  if (!siteConfigContent) {
    return null;
  }

  const pageBefore = await readRel(PAGE_TSX);
  if (!pageBefore) {
    return null;
  }

  const { plan, snapshot, usedLlm } = await planImagePlacement({
    ownerMessage: options.ownerMessage,
    attachments,
    siteConfigContent,
    pageContent: pageBefore,
  });

  const updatedSiteConfig = applyImagePlacementToSiteConfig(
    siteConfigContent,
    plan,
    attachments,
    snapshot
  );

  const beforeFiles: Record<string, string> = {
    [SITE_CONFIG]: siteConfigContent,
    [PAGE_TSX]: pageBefore,
  };

  await writeRel(SITE_CONFIG, updatedSiteConfig);

  const afterWriteConfig = (await readRel(SITE_CONFIG)) ?? '';
  const missingUrls = attachments.filter(
    (a) => !afterWriteConfig.includes(a.publicUrl)
  );
  if (missingUrls.length > 0) {
    return {
      ok: false,
      strategy: 'image_gallery',
      error: 'siteConfig was written but uploaded image URLs are missing from sections.',
      ownerMessage:
        'Images were uploaded but could not be linked into your homepage content. Please try again.',
    };
  }

  let pageAfter = pageBefore;
  const { content: patchedPage, patched } = patchPageForUploadedImages(pageBefore);
  if (patched) {
    await writeRel(PAGE_TSX, patchedPage);
    pageAfter = patchedPage;
  } else {
    pageAfter = (await readRel(PAGE_TSX)) ?? pageBefore;
  }

  if (!pageCanRenderGallerySection(pageAfter)) {
    return {
      ok: false,
      strategy: 'image_gallery',
      error: 'page.tsx does not render gallery item images (missing gallery/generic renderer).',
      ownerMessage:
        "Your images were saved, but this site's page template still can't display them. Please try again after the latest deploy.",
    };
  }

  const afterSiteConfig = (await readRel(SITE_CONFIG)) ?? updatedSiteConfig;
  const afterFiles: Record<string, string> = {
    [SITE_CONFIG]: afterSiteConfig,
    [PAGE_TSX]: pageAfter,
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

  const ownerMessage = describePlacementForOwner(plan, attachments.length);
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
