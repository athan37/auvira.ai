const GALLERY_SECTION_COMPONENT = `
// Product / project photo gallery (dedicated layout — not generic cards)
function GallerySection({ section }: { section: SiteSection }) {
  const images = (section.items || []).filter((item) => (item as { imageUrl?: string }).imageUrl);
  const count = images.length;
  const gridClass =
    count <= 1
      ? "mx-auto max-w-4xl"
      : count === 2
        ? "grid gap-8 md:grid-cols-2"
        : count === 3
          ? "grid gap-8 md:grid-cols-3"
          : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section id="gallery" className={"px-4 py-20 sm:px-6 lg:px-8 " + preset.mutedBg}>
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <p className={"mb-3 text-xs font-bold uppercase tracking-[0.28em] " + preset.sectionEyebrow}>Gallery</p>
          <h2 className={"text-3xl font-semibold tracking-tight md:text-5xl " + preset.sectionTitle}>{section.title}</h2>
          {section.body && <p className={"mt-5 text-lg leading-8 " + preset.sectionBody}>{section.body}</p>}
        </div>
        {count > 0 && (
          <div className={gridClass}>
            {images.map((item, i) => (
              <figure
                key={i}
                className={
                  count === 1
                    ? "overflow-hidden rounded-[2rem] border shadow-xl " + preset.card
                    : "overflow-hidden rounded-3xl border shadow-md " + preset.card
                }
              >
                <img
                  src={(item as { imageUrl: string }).imageUrl}
                  alt={(item as { description?: string }).description || section.title || "Gallery image"}
                  className={
                    count === 1
                      ? "w-full max-h-[32rem] object-cover"
                      : "h-56 w-full object-cover md:h-64"
                  }
                />
                {(item as { description?: string }).description ? (
                  <figcaption className="px-5 py-4 text-sm leading-6 text-slate-600">
                    {(item as { description: string }).description}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
`;

export function pageHasGalleryRenderer(pageContent: string): boolean {
  return (
    pageContent.includes('function GallerySection') &&
    /case\s*['"]gallery['"]/.test(pageContent)
  );
}

/**
 * Add GallerySection + wire SectionRenderer case "gallery".
 */
export function patchGallerySectionInPage(pageContent: string): {
  content: string;
  patched: boolean;
} {
  if (pageHasGalleryRenderer(pageContent)) {
    return { content: pageContent, patched: false };
  }

  let content = pageContent;
  let patched = false;

  if (!content.includes('function GallerySection')) {
    const anchor = content.indexOf('function SectionRenderer');
    if (anchor < 0) {
      return { content: pageContent, patched: false };
    }
    content = content.slice(0, anchor) + GALLERY_SECTION_COMPONENT + '\n' + content.slice(anchor);
    patched = true;
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
    }
  }

  return { content, patched };
}
