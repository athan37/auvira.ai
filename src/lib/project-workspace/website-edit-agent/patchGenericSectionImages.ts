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
  if (pageContent.includes('item.imageUrl') || pageContent.includes('imageUrl')) {
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

  return { content: pageContent, patched: false };
}
