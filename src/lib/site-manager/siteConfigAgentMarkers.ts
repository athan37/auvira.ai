/** Markers appended by the edit agent to force dev-server reload; stripped before parse. */

export const SITECONFIG_GALLERY_SYNC_MARKER = '// site-agent: siteconfig gallery sync';
export const SITECONFIG_GALLERY_SYNC_EXPORT = '__siteAgentGallerySync';
export const PAGE_GALLERY_SYNC_EXPORT = '__siteAgentPageGallerySync';
export const PAGE_GALLERY_SYNC_MARKER = '// site-agent: page gallery sync';

const MARKER_LINE_PATTERNS = [
  new RegExp(`^${escapeRe(SITECONFIG_GALLERY_SYNC_MARKER)} \\d+\\s*$`, 'gm'),
  new RegExp(`^${escapeRe(PAGE_GALLERY_SYNC_MARKER)} \\d+\\s*$`, 'gm'),
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
  const without = stripAgentSyncMarkers(content);
  return `${without}\n\n${PAGE_GALLERY_SYNC_MARKER} ${Date.now()}\n`;
}

/** Strip dev-only markers before committing to GitLab / production deploys. */
export function sanitizeSourceForPublish(filePath: string, content: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  if (
    normalized === 'src/app/page.tsx' ||
    normalized === 'src/lib/siteConfig.ts' ||
    normalized.endsWith('/src/app/page.tsx') ||
    normalized.endsWith('/src/lib/siteConfig.ts')
  ) {
    return stripAgentSyncMarkers(content);
  }
  return content;
}
