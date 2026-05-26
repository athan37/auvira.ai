import { appendPageGallerySyncExport } from '@/lib/site-manager/siteConfigAgentMarkers';
import { ensureSectionLoopInPage } from './ensureSectionLoop';
import { GALLERY_SECTION_COMPONENT, GENERIC_SECTION_COMPONENT } from './imageRendererBlocks';
import type { PageArchetype } from './resolveSiteWorkspace';
import { repairPageTsxStructure } from '../repairPageTsxStructure';
import { isValidTsxSource } from '../validateTsxSyntax';

export { GALLERY_SECTION_COMPONENT, GENERIC_SECTION_COMPONENT } from './imageRendererBlocks';

export const IMAGE_GRID_BLOCK = `
        {section.items?.some((item) => (item as { imageUrl?: string }).imageUrl) && (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {section.items
              .filter((item) => (item as { imageUrl?: string }).imageUrl)
              .map((item, i) => (
                <figure key={i} className={"overflow-hidden rounded-3xl border " + preset.card}>
                  <img
                    src={(item as { imageUrl: string }).imageUrl}
                    alt={item.title || "Product image"}
                    className="h-48 w-full object-cover"
                  />
                  {item.title ? (
                    <figcaption className="p-4 text-sm font-semibold text-slate-950">{item.title}</figcaption>
                  ) : null}
                </figure>
              ))}
          </div>
        )}
`;

const DOC_IMAGE_GRID_BLOCK = `
        {section.items?.some((item) => (item as { imageUrl?: string }).imageUrl) && (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {section.items
              .filter((item) => (item as { imageUrl?: string }).imageUrl)
              .map((item, i) => (
                <figure key={i} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <img
                    src={(item as { imageUrl: string }).imageUrl}
                    alt={item.title || "Product image"}
                    className="h-48 w-full object-cover"
                  />
                  {item.title ? (
                    <figcaption className="p-4 text-sm font-semibold text-slate-950">{item.title}</figcaption>
                  ) : null}
                </figure>
              ))}
          </div>
        )}
`;

export interface UniversalPatchResult {
  content: string;
  patched: boolean;
  anchors: string[];
}

function findSectionRendererAnchor(pageContent: string): number {
  const patterns = ['function SectionRenderer', 'const SectionRenderer ='];
  for (const p of patterns) {
    const idx = pageContent.indexOf(p);
    if (idx >= 0) return idx;
  }
  return -1;
}

export function pageHasGalleryRenderer(pageContent: string): boolean {
  return (
    pageContent.includes('function GallerySection') &&
    /case\s*['"]gallery['"]/.test(pageContent)
  );
}

export function patchGallerySectionInPage(pageContent: string): UniversalPatchResult {
  if (pageHasGalleryRenderer(pageContent)) {
    return { content: pageContent, patched: false, anchors: [] };
  }

  let content = pageContent;
  const anchors: string[] = [];
  let patched = false;

  if (!content.includes('function GallerySection')) {
    const anchor = findSectionRendererAnchor(content);
    if (anchor < 0) {
      return { content: pageContent, patched: false, anchors: [] };
    }
    content = content.slice(0, anchor) + GALLERY_SECTION_COMPONENT + '\n' + content.slice(anchor);
    patched = true;
    anchors.push('gallery_component');
  }

  if (!/case\s*['"]gallery['"]/.test(content)) {
    const insertBeforeDefault =
      /(switch\s*\(\s*section\.type\s*\)\s*\{[\s\S]*?)(\s*default\s*:\s*return)/;
    if (insertBeforeDefault.test(content)) {
      content = content.replace(
        insertBeforeDefault,
        `$1    case 'gallery': return <GallerySection section={section} />;\n$2`
      );
      patched = true;
      anchors.push('gallery_case');
    }
  }

  return { content, patched, anchors };
}

export function extractGenericSectionSource(pageContent: string): string | null {
  const start = pageContent.indexOf('function GenericSection');
  if (start < 0) return null;
  const after = pageContent.slice(start);
  const endMatch = after.match(/\nfunction [A-Z]/);
  const end = endMatch?.index ?? after.length;
  return after.slice(0, end);
}

export function genericSectionRendersItemImages(pageContent: string): boolean {
  const body = extractGenericSectionSource(pageContent);
  if (!body) return false;
  return (
    /\.filter\(\(item\)[^)]*imageUrl/.test(body) ||
    (/<img[\s\S]*?item\.imageUrl/.test(body) && /grid/.test(body))
  );
}

export function patchGenericSectionForImages(pageContent: string): UniversalPatchResult {
  if (!pageContent.includes('function GenericSection')) {
    return { content: pageContent, patched: false, anchors: [] };
  }
  if (genericSectionRendersItemImages(pageContent)) {
    return { content: pageContent, patched: false, anchors: [] };
  }

  const insertAfterBody = /(\{section\.body && <p[^>]*>\{section\.body\}<\/p>\}\s*\n)(\s*\{section\.items)/;
  if (insertAfterBody.test(pageContent)) {
    return {
      content: pageContent.replace(insertAfterBody, `$1${IMAGE_GRID_BLOCK}\n$2`),
      patched: true,
      anchors: ['generic_after_body'],
    };
  }

  const insertBeforeItemsGrid = /(\n\s*)(\{section\.items && section\.items\.length > 0)/;
  if (insertBeforeItemsGrid.test(pageContent)) {
    return {
      content: pageContent.replace(insertBeforeItemsGrid, `\n${IMAGE_GRID_BLOCK}\n$1$2`),
      patched: true,
      anchors: ['generic_before_items'],
    };
  }

  const afterSingleImageBlock =
    /(\{section\.imageUrl && \([\s\S]*?\n          \)\}\s*\n)(        <\/div>\s*\n      <\/div>)/;
  if (afterSingleImageBlock.test(pageContent)) {
    return {
      content: pageContent.replace(afterSingleImageBlock, `$1${IMAGE_GRID_BLOCK}\n$2`),
      patched: true,
      anchors: ['generic_after_single_image'],
    };
  }

  const beforeSectionClose =
    /(function GenericSection[\s\S]*?)(        <\/div>\s*\n      <\/div>\s*\n    <\/section>)/;
  if (beforeSectionClose.test(pageContent)) {
    return {
      content: pageContent.replace(beforeSectionClose, `$1${IMAGE_GRID_BLOCK}\n$2`),
      patched: true,
      anchors: ['generic_before_section_close'],
    };
  }

  return { content: pageContent, patched: false, anchors: [] };
}

function extractDocumentationSectionSource(pageContent: string): string | null {
  const start = pageContent.indexOf('function DocumentationSection');
  if (start < 0) return null;
  const after = pageContent.slice(start);
  const endMatch = after.match(/\nfunction [A-Z]/);
  const end = endMatch?.index ?? after.length;
  return after.slice(0, end);
}

export function documentationSectionRendersItemImages(pageContent: string): boolean {
  if (!/case\s*['"]documentation['"]/.test(pageContent)) {
    return false;
  }
  const body = extractDocumentationSectionSource(pageContent);
  if (!body) return false;
  return (
    /item\.imageUrl/.test(body) ||
    (/\.filter\(\(item\)[^)]*imageUrl/.test(body) && /<img/.test(body))
  );
}

export function patchDocumentationSectionForImages(pageContent: string): UniversalPatchResult {
  if (!pageContent.includes('function DocumentationSection')) {
    return { content: pageContent, patched: false, anchors: [] };
  }
  if (documentationSectionRendersItemImages(pageContent)) {
    return { content: pageContent, patched: false, anchors: [] };
  }
  if (/src=\{item\.description\}/.test(pageContent)) {
    return {
      content: pageContent.replace(
        /src=\{item\.description\}/g,
        'src={item.imageUrl || item.description}'
      ),
      patched: true,
      anchors: ['doc_use_imageUrl'],
    };
  }

  const body = extractDocumentationSectionSource(pageContent);
  if (!body || /\.filter\(\(item\)[^)]*imageUrl/.test(body)) {
    return { content: pageContent, patched: false, anchors: [] };
  }

  const insertBeforeClose =
    /(function DocumentationSection[\s\S]*?)(        <\/div>\s*\n      <\/div>\s*\n    <\/section>)/;
  if (insertBeforeClose.test(pageContent)) {
    return {
      content: pageContent.replace(insertBeforeClose, `$1${DOC_IMAGE_GRID_BLOCK}\n$2`),
      patched: true,
      anchors: ['doc_image_grid'],
    };
  }

  return { content: pageContent, patched: false, anchors: [] };
}

export function patchEnsureGenericSectionRouting(pageContent: string): UniversalPatchResult {
  let content = pageContent;
  const anchors: string[] = [];
  let patched = false;

  if (!content.includes('function GenericSection')) {
    const anchor = findSectionRendererAnchor(content);
    if (anchor < 0) {
      return { content: pageContent, patched: false, anchors: [] };
    }
    content =
      content.slice(0, anchor) + GENERIC_SECTION_COMPONENT + '\n' + content.slice(anchor);
    patched = true;
    anchors.push('inject_generic_section');
  }

  if (/default:\s*return\s*null/.test(content)) {
    content = content.replace(
      /default:\s*return\s*null/,
      "default: return section.type === 'gallery' ? <GallerySection section={section} /> : <GenericSection section={section} />"
    );
    patched = true;
    anchors.push('default_gallery_or_generic');
  } else if (
    /default:\s*return\s*<GenericSection/.test(content) &&
    !/section\.type === ['"]gallery['"]/.test(content)
  ) {
    const insertBeforeDefault =
      /(switch\s*\(\s*section\.type\s*\)\s*\{[\s\S]*?)(\s*default\s*:\s*return\s*<GenericSection)/;
    if (insertBeforeDefault.test(content) && !/case\s*['"]gallery['"]/.test(content)) {
      content = content.replace(
        insertBeforeDefault,
        `$1    case 'gallery': return <GallerySection section={section} />;\n$2`
      );
      patched = true;
      anchors.push('gallery_case_before_generic_default');
    }
  }

  return { content, patched, anchors };
}

export function patchSectionRendererDocumentationCase(pageContent: string): UniversalPatchResult {
  if (!pageContent.includes('function DocumentationSection')) {
    return { content: pageContent, patched: false, anchors: [] };
  }
  if (/case\s*['"]documentation['"]/.test(pageContent)) {
    return { content: pageContent, patched: false, anchors: [] };
  }
  const insertBeforeDefault =
    /(switch\s*\(\s*section\.type\s*\)\s*\{[\s\S]*?)(\s*default\s*:\s*return\s*<GenericSection)/;
  if (!insertBeforeDefault.test(pageContent)) {
    return { content: pageContent, patched: false, anchors: [] };
  }
  return {
    content: pageContent.replace(
      insertBeforeDefault,
      `$1    case "documentation": return <DocumentationSection section={section} />;\n$2`
    ),
    patched: true,
    anchors: ['documentation_case'],
  };
}

/**
 * Apply all page.tsx patches for uploaded images (fixed order).
 */
export function applyUniversalImageRenderer(
  pageContent: string,
  archetype?: PageArchetype
): UniversalPatchResult {
  let content = pageContent;
  const anchors: string[] = [];
  let patched = false;

  if (archetype === 'hardcoded' && !/SectionRenderer/.test(content)) {
    const loop = ensureSectionLoopInPage(content);
    if (loop.patched) {
      content = loop.content;
      patched = true;
      if (loop.anchor) anchors.push(loop.anchor);
    }
  }

  const steps = [
    () => patchGallerySectionInPage(content),
    () => patchEnsureGenericSectionRouting(content),
    () => patchDocumentationSectionForImages(content),
    () => patchSectionRendererDocumentationCase(content),
    () => patchGenericSectionForImages(content),
  ];

  for (const step of steps) {
    const result = step();
    if (result.patched) {
      content = result.content;
      patched = true;
      anchors.push(...result.anchors);
    }
  }

  const structural = repairPageTsxStructure(content);
  if (structural.repaired) {
    content = structural.content;
    patched = true;
    anchors.push(...structural.notes);
  }

  if (patched && !isValidTsxSource(content, 'page.tsx')) {
    return { content: pageContent, patched: false, anchors: ['reverted_invalid_page_tsx'] };
  }

  return { content, patched, anchors };
}

/** @deprecated Use applyUniversalImageRenderer */
export function patchPageForUploadedImages(pageContent: string): {
  content: string;
  patched: boolean;
} {
  const result = applyUniversalImageRenderer(pageContent);
  return { content: result.content, patched: result.patched };
}

/** @deprecated Legacy inline comment marker; parser strips these if present. */
export const GALLERY_PREVIEW_SYNC_MARKER = '// site-agent: gallery preview sync';

/** Bump a dedicated export so page.tsx changes without breaking TSX parse. */
export function stampPageForGalleryPreviewReload(pageContent: string): string {
  return appendPageGallerySyncExport(pageContent);
}

export function canRenderUploadedImages(pageContent: string, archetype?: PageArchetype): boolean {
  if (pageHasGalleryRenderer(pageContent)) return true;
  if (genericSectionRendersItemImages(pageContent)) return true;
  if (documentationSectionRendersItemImages(pageContent)) return true;
  const simulated = applyUniversalImageRenderer(pageContent, archetype);
  return simulated.patched || pageHasGalleryRenderer(simulated.content);
}

/** @deprecated Use canRenderUploadedImages */
export function pageCanRenderGallerySection(pageContent: string): boolean {
  return canRenderUploadedImages(pageContent);
}
