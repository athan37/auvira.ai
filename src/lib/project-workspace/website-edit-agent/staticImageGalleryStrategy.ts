import { promises as fs } from 'fs';
import path from 'path';
import {
  computeWorkspaceHashes,
  getChangedFilesFromHashes,
} from '../workspaceEditShared';
import { humanizeImageItemTitle, inferGallerySectionBody, inferGallerySectionTitle } from './gallerySiteConfig';
import { resolveSiteWorkspace } from './resolveSiteWorkspace';
import type { WorkspaceAssetAttachment } from '../workspaceAssetTypes';
import type { WebsiteEditAgentOptions, WebsiteEditAgentResult } from './types';

interface StaticGallerySection {
  type: string;
  title: string;
  body?: string;
  items: Array<{ title: string; imageUrl: string; description?: string }>;
}

interface StaticSiteJson {
  siteTitle?: string;
  sections?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

function buildGalleryHtml(
  title: string,
  body: string,
  items: Array<{ title: string; imageUrl: string }>
): string {
  const figures = items
    .map(
      (item) => `
        <figure class="gallery-item">
          <img src="${item.imageUrl}" alt="${item.title.replace(/"/g, '&quot;')}" loading="lazy" />
          ${item.title ? `<figcaption>${item.title}</figcaption>` : ''}
        </figure>`
    )
    .join('\n');

  return `
  <section class="section gallery-section" id="gallery">
    <div class="container">
      <div class="section__header">
        <p class="section__eyebrow">Gallery</p>
        <h2 class="section__title">${title}</h2>
        <p class="section__subtitle">${body}</p>
      </div>
      <div class="gallery-grid">
        ${figures}
      </div>
    </div>
  </section>`;
}

function patchStaticSiteJson(
  raw: string,
  message: string,
  attachments: WorkspaceAssetAttachment[]
): { content: string; ok: boolean } {
  let spec: StaticSiteJson;
  try {
    spec = JSON.parse(raw) as StaticSiteJson;
  } catch {
    return { content: raw, ok: false };
  }

  const title = inferGallerySectionTitle(message);
  const body = inferGallerySectionBody(message);
  const items = attachments.map((asset, index) => ({
    title: humanizeImageItemTitle(asset.originalName, index),
    imageUrl: asset.publicUrl,
  }));

  const gallerySection: StaticGallerySection = { type: 'gallery', title, body, items };
  const sections: StaticGallerySection[] = Array.isArray(spec.sections)
    ? (spec.sections as unknown as StaticGallerySection[])
    : [];
  const existingIdx = sections.findIndex(
    (s) => String(s.type).toLowerCase() === 'gallery' || /gallery|product|work/i.test(String(s.title))
  );
  if (existingIdx >= 0) {
    const existing = sections[existingIdx];
    const mergedItems = [...(existing.items || []), ...items];
    sections[existingIdx] = { ...existing, ...gallerySection, items: mergedItems };
  } else {
    sections.unshift(gallerySection);
  }
  const outSpec = { ...spec, sections };
  const out = JSON.stringify(outSpec, null, 2);
  const urlsOk = attachments.every((a) => out.includes(a.publicUrl));
  return { content: out, ok: urlsOk };
}

function patchStaticIndexHtml(
  html: string,
  galleryBlock: string,
  attachments: WorkspaceAssetAttachment[]
): { content: string; ok: boolean } {
  let content = html;
  const hasGallery = /id=["']gallery["']|class=["'][^"']*gallery-section/.test(html);

  if (hasGallery) {
    const galleryReplace =
      /<section[^>]*(?:id=["']gallery["']|class=["'][^"']*gallery-section)[^>]*>[\s\S]*?<\/section>/i;
    if (galleryReplace.test(content)) {
      content = content.replace(galleryReplace, galleryBlock.trim());
    } else {
      content = injectGalleryBeforeFooter(content, galleryBlock);
    }
  } else {
    content = injectGalleryBeforeFooter(content, galleryBlock);
  }

  const urlsOk = attachments.every((a) => content.includes(a.publicUrl));
  return { content, ok: urlsOk };
}

function injectGalleryBeforeFooter(html: string, galleryBlock: string): string {
  const footerIdx = html.search(/<footer[\s>]/i);
  const mainClose = html.lastIndexOf('</main>');
  if (footerIdx >= 0) {
    return html.slice(0, footerIdx) + galleryBlock + '\n' + html.slice(footerIdx);
  }
  if (mainClose >= 0) {
    return html.slice(0, mainClose) + galleryBlock + '\n' + html.slice(mainClose);
  }
  const bodyClose = html.lastIndexOf('</body>');
  if (bodyClose >= 0) {
    return html.slice(0, bodyClose) + galleryBlock + '\n' + html.slice(bodyClose);
  }
  return html + galleryBlock;
}

/**
 * Static workspace: site.json gallery section + index.html image grid.
 */
export async function runStaticImageGalleryStrategy(
  options: WebsiteEditAgentOptions,
  beforeHashes: Record<string, string>
): Promise<WebsiteEditAgentResult | null> {
  const attachments = options.attachments ?? [];
  if (options.mode !== 'static' || attachments.length === 0) {
    return null;
  }

  const workspace = await resolveSiteWorkspace({
    workspacePath: options.workspacePath,
    mode: options.mode,
    gateway: options.gateway,
  });

  const indexPath = workspace.indexHtmlPath ?? 'index.html';
  const siteJsonPath = workspace.siteJsonPath ?? 'site.json';
  const indexBefore = workspace.indexHtmlContent;
  const siteJsonBefore = workspace.siteJsonContent;

  if (!indexBefore) return null;

  async function writeRel(rel: string, content: string): Promise<void> {
    if (options.gateway) {
      await options.gateway.writeFile(rel, content);
    } else {
      await fs.writeFile(path.join(options.workspacePath, rel), content, 'utf-8');
    }
  }

  const title = inferGallerySectionTitle(options.ownerMessage);
  const body = inferGallerySectionBody(options.ownerMessage);
  const items = attachments.map((asset, index) => ({
    title: humanizeImageItemTitle(asset.originalName, index),
    imageUrl: asset.publicUrl,
  }));

  const galleryBlock = buildGalleryHtml(title, body, items);
  const { content: indexAfter, ok: htmlOk } = patchStaticIndexHtml(
    indexBefore,
    galleryBlock,
    attachments
  );

  let siteJsonAfter = siteJsonBefore ?? '{}';
  let jsonOk = true;
  if (siteJsonBefore) {
    const patched = patchStaticSiteJson(siteJsonBefore, options.ownerMessage, attachments);
    siteJsonAfter = patched.content;
    jsonOk = patched.ok;
  }

  if (!htmlOk) {
    return {
      ok: false,
      strategy: 'image_gallery',
      error: `static_html patch failed: URLs missing in index.html (archetype=${workspace.archetype})`,
      ownerMessage: 'Images were uploaded but could not be added to your page. Please try again.',
    };
  }

  await writeRel(indexPath, indexAfter);
  if (siteJsonBefore && jsonOk) {
    await writeRel(siteJsonPath, siteJsonAfter);
  }

  const afterHashes = options.gateway
    ? await options.gateway.computeHashes()
    : await computeWorkspaceHashes(options.workspacePath);
  const changedFiles = getChangedFilesFromHashes(beforeHashes, afterHashes);
  if (changedFiles.length === 0) return null;

  const summary = `Added a gallery section with ${attachments.length} image(s) to your site.`;
  return {
    ok: true,
    strategy: 'image_gallery',
    summary,
    ownerMessage: summary,
    changedFiles,
  };
}

/** Verify static HTML contains all upload URLs. */
export function validateStaticGalleryFiles(
  indexHtml: string,
  siteJson: string | null,
  attachments: WorkspaceAssetAttachment[]
): { ok: boolean; reason: string } {
  const missing = attachments.filter((a) => !indexHtml.includes(a.publicUrl));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `index.html missing ${missing.length} upload URL(s)`,
    };
  }
  if (siteJson) {
    const missingJson = attachments.filter((a) => !siteJson.includes(a.publicUrl));
    if (missingJson.length > 0) {
      return {
        ok: false,
        reason: `site.json missing ${missingJson.length} upload URL(s)`,
      };
    }
  }
  return { ok: true, reason: 'static gallery OK' };
}
