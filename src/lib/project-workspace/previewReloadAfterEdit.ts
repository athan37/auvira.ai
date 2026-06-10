/**
 * Customer workspace Next.js dev server often lags behind saved file edits.
 * Iframe reload timing helpers keep the UI in sync without redundant React remounts.
 */

const PREVIEW_RELOAD_PATHS = [
  'src/lib/siteConfig.ts',
  'src/app/page.tsx',
  'tailwind.config.js',
] as const;

/**
 * Post-message reload delay when preview verify already passed on the server.
 * Stream route waits for compile before emitting done — parent can reload immediately.
 */
export const PREVIEW_IFRAME_SETTLE_MS = 0;

/** Extra wait when server reports preview still syncing (dev compile lag). */
export const PREVIEW_UNSYNCED_EXTRA_MS = 3_000;

export type PreviewReloadSchedule = {
  cancel: () => void;
};

export type PreviewReloadOptions = {
  changedPaths?: string[];
  previewSynced?: boolean;
  /** When true, skip reload scheduling (parent defers iframe remount). */
  deferReload?: boolean;
  /** Base delay before reload (defaults to PREVIEW_IFRAME_SETTLE_MS). */
  settleMs?: number;
};

/** Single post-edit reload delay — one bump at the end, not staggered retries. */
export function getSinglePreviewReloadDelayMs(
  options: Pick<PreviewReloadOptions, 'previewSynced' | 'settleMs'> = {}
): number {
  const settleMs = options.settleMs ?? PREVIEW_IFRAME_SETTLE_MS;
  if (options.previewSynced === false) {
    return settleMs + PREVIEW_UNSYNCED_EXTRA_MS;
  }
  return settleMs;
}

/** @deprecated Use getSinglePreviewReloadDelayMs — kept for tests migrating off multi-reload. */
export function getPreviewReloadDelaysMs(
  options: Pick<PreviewReloadOptions, 'settleMs'> = {}
): number[] {
  return [getSinglePreviewReloadDelayMs({ previewSynced: true, ...options })];
}

/** True when changed files affect the editable preview bundle (not just copy in JSON). */
export function workspaceEditNeedsPreviewReload(changedPaths: string[]): boolean {
  const normalized = changedPaths.map((p) => p.replace(/\\/g, '/'));
  return normalized.some((p) =>
    PREVIEW_RELOAD_PATHS.some((needle) => p === needle || p.endsWith(`/${needle}`))
  );
}

/**
 * Schedule one iframe cache-bust after edit when preview-affecting files changed.
 * Parent bumps previewRefreshKey once; frame syncs workspace version on that bump.
 */
export function schedulePreviewIframeReloads(
  bump: () => void,
  options: PreviewReloadOptions
): PreviewReloadSchedule {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const cancel = () => {
    for (const id of timers) {
      clearTimeout(id);
    }
    timers.length = 0;
  };

  if (options.deferReload) {
    return { cancel };
  }

  if (!workspaceEditNeedsPreviewReload(options.changedPaths ?? [])) {
    return { cancel };
  }

  const delayMs = getSinglePreviewReloadDelayMs(options);
  timers.push(setTimeout(() => bump(), delayMs));

  return { cancel };
}
