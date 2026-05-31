/**
 * Customer workspace Next.js dev server often lags behind saved file edits.
 * Iframe reload timing helpers keep the UI in sync without redundant React remounts.
 */

const PREVIEW_RELOAD_PATHS = [
  'src/lib/siteConfig.ts',
  'src/app/page.tsx',
  'tailwind.config.js',
] as const;

/** Wait for workspace next dev to finish recompiling before first iframe reload. */
export const PREVIEW_IFRAME_SETTLE_MS = 2_000;

/** Delays after settle when server says preview is still syncing (dev compile lag). */
const SYNC_RELOAD_DELAYS_MS = [2_500, 7_000] as const;

export type PreviewReloadSchedule = {
  cancel: () => void;
};

export type PreviewReloadOptions = {
  changedPaths?: string[];
  previewSynced?: boolean;
  /** When true, skip immediate reload scheduling (parent defers iframe remount). */
  deferReload?: boolean;
  /** Extra delay before first reload bump (defaults to PREVIEW_IFRAME_SETTLE_MS). */
  settleMs?: number;
};

/** Delays used by schedulePreviewIframeReloads (settle + sync reloads). */
export function getPreviewReloadDelaysMs(options: Pick<PreviewReloadOptions, 'settleMs'> = {}): number[] {
  const settleMs = options.settleMs ?? PREVIEW_IFRAME_SETTLE_MS;
  return [settleMs, ...SYNC_RELOAD_DELAYS_MS.map((d) => settleMs + d)];
}

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

  if (options.previewSynced !== false) {
    return { cancel };
  }

  if (!workspaceEditNeedsPreviewReload(options.changedPaths ?? [])) {
    return { cancel };
  }

  for (const delayMs of getPreviewReloadDelaysMs({ settleMs: options.settleMs })) {
    timers.push(setTimeout(() => bump(), delayMs));
  }

  return { cancel };
}
