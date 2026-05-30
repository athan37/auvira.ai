/**
 * Lightweight client-side performance marks for the project editor.
 * Marks are no-ops when `performance` is unavailable (SSR).
 */

export type EditorVitalName =
  | 'editor.preview_ready'
  | 'editor.chat_history_loaded'
  | 'editor.iframe_reload';

const PREFIX = 'site-agent:';

/** Record a named vital with optional detail (logged in dev). */
export function markEditorVital(name: EditorVitalName, detail?: Record<string, unknown>): void {
  if (typeof performance === 'undefined') return;
  const markName = `${PREFIX}${name}`;
  try {
    performance.mark(markName);
  } catch {
    /* duplicate mark — ignore */
  }
  if (process.env.NODE_ENV === 'development' && detail) {
    console.debug(`[vitals] ${name}`, detail);
  }
}

/** Measure duration from navigation start to a vital mark. */
export function measureEditorVital(name: EditorVitalName): number | null {
  if (typeof performance === 'undefined') return null;
  const markName = `${PREFIX}${name}`;
  const entry = performance.getEntriesByName(markName, 'mark')[0];
  if (!entry) return null;
  return Math.round(entry.startTime);
}

/** Increment iframe reload counter for the current session. */
let iframeReloadCount = 0;

export function recordIframeReload(projectId: string): number {
  iframeReloadCount += 1;
  markEditorVital('editor.iframe_reload', { projectId, count: iframeReloadCount });
  return iframeReloadCount;
}

export function getIframeReloadCount(): number {
  return iframeReloadCount;
}

export function resetEditorVitalsForTests(): void {
  iframeReloadCount = 0;
}
