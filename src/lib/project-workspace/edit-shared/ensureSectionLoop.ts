import {
  GALLERY_SECTION_COMPONENT,
  GENERIC_SECTION_COMPONENT,
  SECTION_PRESENTATION_RUNTIME,
} from './imageRendererBlocks';

const SECTION_RENDERER_SWITCH = `
function SectionRenderer({ section }: { section: SiteSection }) {
  switch (section.type) {
    case "gallery": return <GallerySection section={section} />;
    default: return <GenericSection section={section} />;
  }
}
`;

const SECTION_LOOP_BLOCK = `
      {siteConfig.sections.map((section, index) => (
        <SectionRenderer key={section.type + "-" + index} section={section} />
      ))}
`;

function findSectionRendererAnchor(pageContent: string): number {
  const patterns = [
    'function SectionRenderer',
    'const SectionRenderer =',
    'function SectionRenderer(',
  ];
  for (const p of patterns) {
    const idx = pageContent.indexOf(p);
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Inject minimal section loop + GallerySection/GenericSection for hardcoded Home pages.
 */
export function ensureSectionLoopInPage(pageContent: string): {
  content: string;
  patched: boolean;
  anchor?: string;
} {
  if (/siteConfig\.sections/.test(pageContent) && /SectionRenderer/.test(pageContent)) {
    return { content: pageContent, patched: false };
  }

  let content = pageContent;
  let patched = false;
  let anchor = '';

  if (!content.includes('function GallerySection')) {
    const srAnchor = findSectionRendererAnchor(content);
    const insertAt = srAnchor >= 0 ? srAnchor : content.indexOf('export default function');
    if (insertAt >= 0) {
      const presentationHelpers = content.includes('function resolveSectionBackground')
        ? ''
        : `${SECTION_PRESENTATION_RUNTIME}\n`;
      content =
        content.slice(0, insertAt) +
        presentationHelpers +
        GALLERY_SECTION_COMPONENT +
        '\n' +
        GENERIC_SECTION_COMPONENT +
        '\n' +
        SECTION_RENDERER_SWITCH +
        '\n' +
        content.slice(insertAt);
      patched = true;
      anchor = 'inject_components_before_home';
    }
  }

  if (!/siteConfig\.sections/.test(content)) {
    const mainClose = content.indexOf('</main>');
    const footerIdx = content.indexOf('<Footer');
    const hasInsertTarget = mainClose >= 0 || footerIdx >= 0 || content.lastIndexOf(');') >= 0;

    if (hasInsertTarget) {
      if (!content.includes('import { siteConfig }')) {
        const importAnchor = content.indexOf('\n');
        content =
          content.slice(0, importAnchor + 1) +
          'import { siteConfig } from "@/lib/siteConfig";\n' +
          'import type { SiteSection } from "@/lib/siteConfig";\n' +
          content.slice(importAnchor + 1);
        patched = true;
        anchor = anchor || 'add_siteConfig_import';
      }
      const loopInsert = content.indexOf('</main>');
      const loopAt =
        loopInsert >= 0
          ? loopInsert
          : content.indexOf('<Footer') >= 0
            ? content.indexOf('<Footer')
            : content.lastIndexOf(');');
      if (loopAt >= 0) {
        content = content.slice(0, loopAt) + SECTION_LOOP_BLOCK + '\n' + content.slice(loopAt);
        patched = true;
        anchor = anchor || 'inject_section_map';
      }
    }
  }

  return { content, patched, anchor: patched ? anchor : undefined };
}
