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
export function patchDocumentationSectionForImages(pageContent: string): {
  content: string;
  patched: boolean;
} {
  if (!pageContent.includes('function DocumentationSection')) {
    return { content: pageContent, patched: false };
  }
  if (!/src=\{item\.description\}/.test(pageContent)) {
    return { content: pageContent, patched: false };
  }
  return {
    content: pageContent.replace(
      /src=\{item\.description\}/g,
      'src={item.imageUrl || item.description}'
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
  const doc = patchDocumentationSectionForImages(content);
  if (doc.patched) {
    content = doc.content;
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
  if (pageContent.includes('function DocumentationSection')) {
    return /case\s*['"]documentation['"]/.test(pageContent);
  }
  return genericSectionRendersItemImages(pageContent) || patchPageForUploadedImages(pageContent).patched;
}
