/** Markers appended by the edit agent to force dev-server reload; stripped before parse. */

export const SITECONFIG_GALLERY_SYNC_MARKER = '// site-agent: siteconfig gallery sync';
export const SITECONFIG_GALLERY_SYNC_EXPORT = '__siteAgentGallerySync';
/** Bumped on siteConfig presentation edits to force Next dev server module reload. */
export const SITECONFIG_PRESENTATION_SYNC_EXPORT = '__siteConfigSyncVersion';
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
    `^export const ${SITECONFIG_PRESENTATION_SYNC_EXPORT} = \\d+;\\s*$`,
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

/** Next.js pages reject unknown exports like __siteAgentPageGallerySync (legacy agent stamps). */
export function stripInvalidNextJsPageExports(content: string): string {
  return content
    .replace(/^export const __site[A-Za-z0-9_]+ = \d+;\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/** Bump sync version export so siteConfig.ts changes reload in the workspace dev server. */
export function appendSiteConfigPresentationSyncExport(content: string): string {
  const stripped = stripAgentSyncMarkers(content);
  return `${stripped}\n\nexport const ${SITECONFIG_PRESENTATION_SYNC_EXPORT} = ${Date.now()};\n`;
}

export function appendSiteConfigGallerySyncExport(content: string): string {
  return appendSiteConfigPresentationSyncExport(content);
}

export function appendPageGallerySyncExport(content: string): string {
  const without = stripAgentSyncMarkers(content);
  return `${without}\n\n${PAGE_GALLERY_SYNC_MARKER} ${Date.now()}\n`;
}

/** Strip dev-only markers before committing to GitLab / production deploys. */
export function sanitizeSourceForPublish(filePath: string, content: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const isPage =
    normalized === 'src/app/page.tsx' || normalized.endsWith('/src/app/page.tsx');
  const isSiteConfig =
    normalized === 'src/lib/siteConfig.ts' || normalized.endsWith('/src/lib/siteConfig.ts');

  if (isPage) {
    return stripInvalidNextJsPageExports(stripAgentSyncMarkers(content));
  }
  if (isSiteConfig) {
    return stripAgentSyncMarkers(content);
  }
  return content;
}

const AGENT_MARKER_FILE_PATHS = ['src/app/page.tsx', 'src/lib/siteConfig.ts'] as const;

/** Write sanitized page/siteConfig sources to disk before git publish or deploy. */
export async function sanitizeAgentMarkerFilesInWorkspace(
  workspacePath: string,
  readWrite?: {
    read: (rel: string) => Promise<string | null>;
    write: (rel: string, content: string) => Promise<void>;
  }
): Promise<string[]> {
  const { promises: fs } = await import('fs');
  const path = await import('path');
  const sanitized: string[] = [];

  for (const rel of AGENT_MARKER_FILE_PATHS) {
    let before: string | null = null;
    if (readWrite) {
      before = await readWrite.read(rel);
    } else {
      try {
        before = await fs.readFile(path.join(workspacePath, rel), 'utf-8');
      } catch {
        before = null;
      }
    }
    if (before == null) continue;

    const after = sanitizeSourceForPublish(rel, before);
    if (after === before) continue;

    if (readWrite) {
      await readWrite.write(rel, after);
    } else {
      await fs.writeFile(path.join(workspacePath, rel), after, 'utf-8');
    }
    sanitized.push(rel);
  }

  return sanitized;
}
