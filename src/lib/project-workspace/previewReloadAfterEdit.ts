/**
 * Customer workspace Next.js dev server often lags behind saved file edits.
 * Iframe reload timing helpers keep the UI in sync with server-side preview verify.
 */

const PREVIEW_RELOAD_PATHS = [
  'src/lib/siteConfig.ts',
  'src/app/page.tsx',
  'tailwind.config.js',
] as const;

/** True when changed files affect the editable preview bundle (not just copy in JSON). */
export function workspaceEditNeedsPreviewReload(changedPaths: string[]): boolean {
  const normalized = changedPaths.map((p) => p.replace(/\\/g, '/'));
  return normalized.some((p) =>
    PREVIEW_RELOAD_PATHS.some((needle) => p === needle || p.endsWith(`/${needle}`))
  );
}

/**
 * Schedule iframe reload bumps so preview catches up after siteConfig/page edits.
 * Immediate bump + delayed bumps when compile/HMR may still be in flight.
 */
export function schedulePreviewIframeReloads(
  bump: () => void,
  options: { changedPaths?: string[]; previewSynced?: boolean }
): void {
  bump();

  const needsSettle =
    options.previewSynced === false ||
    workspaceEditNeedsPreviewReload(options.changedPaths ?? []);

  if (!needsSettle) {
    return;
  }

  window.setTimeout(bump, 1_000);
  window.setTimeout(bump, 3_000);
  window.setTimeout(bump, 6_000);
  window.setTimeout(bump, 10_000);
}
