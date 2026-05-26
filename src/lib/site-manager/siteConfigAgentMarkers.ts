/** Markers appended by the edit agent to force dev-server reload; stripped before parse. */

export const SITECONFIG_GALLERY_SYNC_MARKER = '// site-agent: siteconfig gallery sync';
export const SITECONFIG_GALLERY_SYNC_EXPORT = '__siteAgentGallerySync';
export const PAGE_GALLERY_SYNC_EXPORT = '__siteAgentPageGallerySync';

const MARKER_LINE_PATTERNS = [
  new RegExp(`^${escapeRe(SITECONFIG_GALLERY_SYNC_MARKER)} \\d+\\s*$`, 'gm'),
  new RegExp(
    `^export const ${SITECONFIG_GALLERY_SYNC_EXPORT} = \\d+;\\s*$`,
    'gm'
  ),
  new RegExp(
    `^export const ${PAGE_GALLERY_SYNC_EXPORT} = \\d+;\\s*$`,
    'gm'
  ),
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Remove agent sync lines so siteConfig parse/rebuild regexes keep working. */
export function stripAgentSyncMarkers(content: string): string {
  let out = content;
  for (const pattern of MARKER_LINE_PATTERNS) {
    out = out.replace(pattern, '');
  }
  return out.replace(/\n{3,}/g, '\n\n').trimEnd();
}

export function appendSiteConfigGallerySyncExport(content: string): string {
  const stripped = stripAgentSyncMarkers(content);
  return `${stripped}\n\nexport const ${SITECONFIG_GALLERY_SYNC_EXPORT} = ${Date.now()};\n`;
}

export function appendPageGallerySyncExport(content: string): string {
  const without = content.replace(
    new RegExp(`^export const ${PAGE_GALLERY_SYNC_EXPORT} = \\d+;\\s*$`, 'gm'),
    ''
  );
  return `${without.trimEnd()}\n\nexport const ${PAGE_GALLERY_SYNC_EXPORT} = ${Date.now()};\n`;
}
