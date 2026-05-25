import { patchGallerySectionInPage, pageHasGalleryRenderer } from './patchGallerySection';

const IMAGE_GRID_BLOCK = `
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

/** Extract GenericSection function source from page.tsx. */
export function extractGenericSectionSource(pageContent: string): string | null {
  const start = pageContent.indexOf('function GenericSection');
  if (start < 0) return null;
  const after = pageContent.slice(start);
  const endMatch = after.match(/\nfunction [A-Z]/);
  const end = endMatch?.index ?? after.length;
  return after.slice(0, end);
}

/** True when GenericSection already maps item.imageUrl into <img> tags. */
export function genericSectionRendersItemImages(pageContent: string): boolean {
  const body = extractGenericSectionSource(pageContent);
  if (!body) return false;
  return (
    /\.filter\(\(item\)[^)]*imageUrl/.test(body) ||
    (/<img[\s\S]*?item\.imageUrl/.test(body) && /grid/.test(body))
  );
}

/**
 * Ensures GenericSection in page.tsx renders uploaded product/documentation images.
 */
export function patchGenericSectionForImages(pageContent: string): {
  content: string;
  patched: boolean;
} {
  if (!pageContent.includes('function GenericSection')) {
    return { content: pageContent, patched: false };
  }
  if (genericSectionRendersItemImages(pageContent)) {
    return { content: pageContent, patched: false };
  }

  const insertAfterBody = /(\{section\.body && <p[^>]*>\{section\.body\}<\/p>\}\s*\n)(\s*\{section\.items)/;
  if (insertAfterBody.test(pageContent)) {
    return {
      content: pageContent.replace(insertAfterBody, `$1${IMAGE_GRID_BLOCK}\n$2`),
      patched: true,
    };
  }

  const insertBeforeItemsGrid = /(\n\s*)(\{section\.items && section\.items\.length > 0)/;
  if (insertBeforeItemsGrid.test(pageContent)) {
    return {
      content: pageContent.replace(insertBeforeItemsGrid, `\n${IMAGE_GRID_BLOCK}\n$1$2`),
      patched: true,
    };
  }

  // Custom 2-column GenericSection (single section.imageUrl + bullet list): add gallery below.
  const afterSingleImageBlock =
    /(\{section\.imageUrl && \([\s\S]*?\n          \)\}\s*\n)(        <\/div>\s*\n      <\/div>)/;
  if (afterSingleImageBlock.test(pageContent)) {
    return {
      content: pageContent.replace(afterSingleImageBlock, `$1${IMAGE_GRID_BLOCK}\n$2`),
      patched: true,
    };
  }

  const beforeSectionClose =
    /(function GenericSection[\s\S]*?)(        <\/div>\s*\n      <\/div>\s*\n    <\/section>)/;
  if (beforeSectionClose.test(pageContent)) {
    return {
      content: pageContent.replace(beforeSectionClose, `$1${IMAGE_GRID_BLOCK}\n$2`),
      patched: true,
    };
  }

  return { content: pageContent, patched: false };
}

/**
 * DocumentationSection often uses item.description as img src; gallery edits use imageUrl.
 */
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

export function patchDocumentationSectionForImages(pageContent: string): {
  content: string;
  patched: boolean;
} {
  if (!pageContent.includes('function DocumentationSection')) {
    return { content: pageContent, patched: false };
  }
  if (documentationSectionRendersItemImages(pageContent)) {
    return { content: pageContent, patched: false };
  }
  if (/src=\{item\.description\}/.test(pageContent)) {
    return {
      content: pageContent.replace(
        /src=\{item\.description\}/g,
        'src={item.imageUrl || item.description}'
      ),
      patched: true,
    };
  }

  const body = extractDocumentationSectionSource(pageContent);
  if (!body || /\.filter\(\(item\)[^)]*imageUrl/.test(body)) {
    return { content: pageContent, patched: false };
  }

  const insertBeforeClose =
    /(function DocumentationSection[\s\S]*?)(        <\/div>\s*\n      <\/div>\s*\n    <\/section>)/;
  if (insertBeforeClose.test(pageContent)) {
    return {
      content: pageContent.replace(insertBeforeClose, `$1${DOC_IMAGE_GRID_BLOCK}\n$2`),
      patched: true,
    };
  }

  return { content: pageContent, patched: false };
}

function extractDocumentationSectionSource(pageContent: string): string | null {
  const start = pageContent.indexOf('function DocumentationSection');
  if (start < 0) return null;
  const after = pageContent.slice(start);
  const endMatch = after.match(/\nfunction [A-Z]/);
  const end = endMatch?.index ?? after.length;
  return after.slice(0, end);
}

/** True when wired DocumentationSection maps item.imageUrl into <img> tags. */
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

const GENERIC_SECTION_COMPONENT = `
// Generic section renderer (fallback for gallery / custom sections)
function GenericSection({ section }: { section: SiteSection }) {
  return (
    <section id={slugify(section.title)} className={"px-4 py-20 sm:px-6 lg:px-8 " + preset.surfaceBg}>
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center mb-14">
          <h2 className={"text-3xl font-semibold tracking-tight md:text-5xl " + preset.sectionTitle}>{section.title}</h2>
          {section.body && <p className={"mt-5 text-lg leading-8 " + preset.sectionBody}>{section.body}</p>}
        </div>
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
        {section.items && section.items.length > 0 && !section.items.some((item) => (item as { imageUrl?: string }).imageUrl) && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {section.items.slice(0, 6).map((item, i) => (
              <div key={i} className={"rounded-3xl border p-7 shadow-sm " + preset.card}>
                <h3 className="text-lg font-bold text-slate-950">{item.title}</h3>
                {item.description && <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
`;

/**
 * Sites cloned without GenericSection use `default: return null` — gallery sections never appear.
 */
export function patchEnsureGenericSectionRouting(pageContent: string): {
  content: string;
  patched: boolean;
} {
  let content = pageContent;
  let patched = false;

  if (!content.includes('function GenericSection')) {
    const anchor = content.indexOf('function SectionRenderer');
    if (anchor < 0) {
      return { content: pageContent, patched: false };
    }
    content =
      content.slice(0, anchor) + GENERIC_SECTION_COMPONENT + '\n' + content.slice(anchor);
    patched = true;
  }

  if (/default:\s*return\s*null/.test(content)) {
    content = content.replace(
      /default:\s*return\s*null/,
      'default: return <GenericSection section={section} />'
    );
    patched = true;
  }

  return { content, patched };
}

/**
 * Wire DocumentationSection when the component exists but SectionRenderer has no case.
 */
export function patchSectionRendererDocumentationCase(pageContent: string): {
  content: string;
  patched: boolean;
} {
  if (!pageContent.includes('function DocumentationSection')) {
    return { content: pageContent, patched: false };
  }
  if (/case\s*['"]documentation['"]/.test(pageContent)) {
    return { content: pageContent, patched: false };
  }
  const insertBeforeDefault =
    /(switch\s*\(\s*section\.type\s*\)\s*\{[\s\S]*?)(\s*default\s*:\s*return\s*<GenericSection)/;
  if (!insertBeforeDefault.test(pageContent)) {
    return { content: pageContent, patched: false };
  }
  return {
    content: pageContent.replace(
      insertBeforeDefault,
      `$1    case "documentation": return <DocumentationSection section={section} />;\n$2`
    ),
    patched: true,
  };
}

/** Apply all page.tsx patches needed for uploaded image sections. */
export function patchPageForUploadedImages(pageContent: string): {
  content: string;
  patched: boolean;
} {
  let content = pageContent;
  let patched = false;
  const gallery = patchGallerySectionInPage(content);
  if (gallery.patched) {
    content = gallery.content;
    patched = true;
  }
  const routing = patchEnsureGenericSectionRouting(content);
  if (routing.patched) {
    content = routing.content;
    patched = true;
  }
  const doc = patchDocumentationSectionForImages(content);
  if (doc.patched) {
    content = doc.content;
    patched = true;
  }
  const docCase = patchSectionRendererDocumentationCase(content);
  if (docCase.patched) {
    content = docCase.content;
    patched = true;
  }
  const generic = patchGenericSectionForImages(content);
  if (generic.patched) {
    content = generic.content;
    patched = true;
  }
  return { content, patched };
}

export function pageCanRenderGallerySection(pageContent: string): boolean {
  if (pageHasGalleryRenderer(pageContent)) {
    return true;
  }
  if (genericSectionRendersItemImages(pageContent)) {
    return true;
  }
  if (documentationSectionRendersItemImages(pageContent)) {
    return true;
  }
  return patchPageForUploadedImages(pageContent).patched;
}
