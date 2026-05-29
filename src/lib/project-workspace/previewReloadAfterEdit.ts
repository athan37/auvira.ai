/**
 * Customer workspace Next.js dev server often lags behind saved file edits.
 * Iframe reload timing helpers keep the UI in sync without redundant React remounts.
 */

const PREVIEW_RELOAD_PATHS = [
  'src/lib/siteConfig.ts',
  'src/app/page.tsx',
  'tailwind.config.js',
] as const;

/** Delays after edit when server says preview is still syncing (dev compile lag). */
const SYNC_SETTLE_DELAYS_MS = [2_500, 7_000] as const;

export type PreviewReloadSchedule = {
  cancel: () => void;
};

/** True when changed files affect the editable preview bundle (not just copy in JSON). */
export function workspaceEditNeedsPreviewReload(changedPaths: string[]): boolean {
  const normalized = changedPaths.map((p) => p.replace(/\\/g, '/'));
  return normalized.some((p) =>
    PREVIEW_RELOAD_PATHS.some((needle) => p === needle || p.endsWith(`/${needle}`))
  );
}

/**
 * Schedule light cache-bust bumps while preview HTML may still be compiling.
 * When previewSynced is true, skip — parent reload via codeWorkspace.version is enough.
 */
export function schedulePreviewIframeReloads(
  bump: () => void,
  options: { changedPaths?: string[]; previewSynced?: boolean }
): PreviewReloadSchedule {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const cancel = () => {
    for (const id of timers) {
      clearTimeout(id);
    }
    timers.length = 0;
  };

  if (options.previewSynced !== false) {
    return { cancel };
  }

  if (!workspaceEditNeedsPreviewReload(options.changedPaths ?? [])) {
    return { cancel };
  }

  for (const delayMs of SYNC_SETTLE_DELAYS_MS) {
    timers.push(setTimeout(() => bump(), delayMs));
  }

  return { cancel };
}
