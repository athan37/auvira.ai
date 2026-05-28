import { SECTION_PRESENTATION_RUNTIME } from '@/lib/builder/sectionPresentationRuntime';

export { SECTION_PRESENTATION_RUNTIME };

export const GALLERY_SECTION_COMPONENT = `
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
    <section id="gallery" className={"px-4 py-20 sm:px-6 lg:px-8 " + resolveSectionBackground(section, preset)}>
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <p className={"mb-3 text-xs font-bold uppercase tracking-[0.28em] " + resolveSectionEyebrowClass(section, preset)}>Gallery</p>
          <h2 className={"text-3xl font-semibold tracking-tight md:text-5xl " + resolveSectionTitleClass(section, preset)}>{section.title}</h2>
          {section.body && <p className={"mt-5 text-lg leading-8 " + resolveSectionBodyClass(section, preset)}>{section.body}</p>}
        </div>
        {count > 0 && (
          <div className={gridClass}>
            {images.map((item, i) => (
              <figure
                key={i}
                className={
                  count === 1
                    ? "overflow-hidden rounded-[2rem] border shadow-xl " + resolveSectionCardClass(section, preset)
                    : "overflow-hidden rounded-3xl border shadow-md " + resolveSectionCardClass(section, preset)
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

export const GENERIC_SECTION_COMPONENT = `
// Generic section renderer (fallback for gallery / custom sections)
function GenericSection({ section }: { section: SiteSection }) {
  return (
    <section id={slugify(section.title)} className={"px-4 py-20 sm:px-6 lg:px-8 " + resolveSectionBackground(section, preset)}>
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center mb-14">
          <h2 className={"text-3xl font-semibold tracking-tight md:text-5xl " + resolveSectionTitleClass(section, preset)}>{section.title}</h2>
          {section.body && <p className={"mt-5 text-lg leading-8 " + resolveSectionBodyClass(section, preset)}>{section.body}</p>}
        </div>
        {section.items?.some((item) => (item as { imageUrl?: string }).imageUrl) && (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {section.items
              .filter((item) => (item as { imageUrl?: string }).imageUrl)
              .map((item, i) => (
                <figure key={i} className={"overflow-hidden rounded-3xl border " + resolveSectionCardClass(section, preset)}>
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
              <div key={i} className={"rounded-3xl border p-7 shadow-sm " + resolveSectionCardClass(section, preset)}>
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
