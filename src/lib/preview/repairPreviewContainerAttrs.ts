/**
 * Inject preview container attrs on legacy page.tsx clones (bridge bootstrap fallback).
 */

const ITEM_GRID_MARKER = 'data-site-container-kind="item_grid"';
const INNER_CARD_MARKER = 'data-site-container-kind="inner_card"';

const CONTAINER_ATTRS_HELPER = `
function SITE_CONTAINER_ATTRS(opts: { kind: string; label: string }) {
  return {
    "data-site-container-kind": opts.kind,
    "data-site-container-label": opts.label,
  };
}
`;

function injectContainerAttrsHelper(content: string): string {
  if (content.includes('function SITE_CONTAINER_ATTRS')) {
    return content;
  }
  if (content.includes('function SITE_ELEMENT_ATTRS(')) {
    return content.replace(
      /function SITE_ELEMENT_ATTRS\(/,
      `${CONTAINER_ATTRS_HELPER}\nfunction SITE_ELEMENT_ATTRS(`
    );
  }
  return content.replace(
    /(function SITE_SECTION_DATA_ATTRS\([\s\S]*?\n\}\n\n)/,
    `$1${CONTAINER_ATTRS_HELPER}\n`
  );
}

/** Add item_grid / inner_card container attrs when missing from generated page.tsx. */
export function repairPreviewContainerAttrsInPage(pageContent: string): {
  content: string;
  repaired: boolean;
} {
  let content = pageContent;
  let repaired = false;

  const usesContainerAttrs = content.includes('SITE_CONTAINER_ATTRS(');
  const hasHelper = content.includes('function SITE_CONTAINER_ATTRS');

  if (!content.includes(INNER_CARD_MARKER) && content.includes('Contact Information')) {
    const innerCardPattern =
      /(<div\s+className=\{"rounded-\[2rem\] border p-8 shadow-2xl " \+ resolveSectionCardClass\(section, preset\)\})(>)/;
    if (innerCardPattern.test(content)) {
      content = content.replace(
        innerCardPattern,
        `$1 {...SITE_CONTAINER_ATTRS({ kind: "inner_card", label: "Contact card" })}$2`
      );
      repaired = true;
    }
  }

  if (!content.includes(ITEM_GRID_MARKER)) {
    const gridPattern =
      /(<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3")(>)/g;
    const next = content.replace(
      gridPattern,
      `$1 {...SITE_CONTAINER_ATTRS({ kind: "item_grid", label: "Item cards" })}$2`
    );
    if (next !== content) {
      content = next;
      repaired = true;
    }
  }

  if (repaired && !content.includes('function SITE_CONTAINER_ATTRS')) {
    content = injectContainerAttrsHelper(content);
  }

  if (usesContainerAttrs && !hasHelper) {
    const next = injectContainerAttrsHelper(content);
    if (next !== content) {
      content = next;
      repaired = true;
    }
  }

  return { content, repaired };
}
