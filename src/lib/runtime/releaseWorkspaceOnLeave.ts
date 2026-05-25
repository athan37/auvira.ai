/**
 * Best-effort scratch release when the owner navigates away from the project editor.
 * Uses keepalive fetch so the request can finish after unmount.
 */
export function releaseWorkspaceOnLeave(projectId: string): void {
  if (!projectId || typeof window === 'undefined') return;

  const url = `/api/projects/${projectId}/workspace/release`;

  try {
    void fetch(url, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    });
  } catch {
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([], { type: 'application/json' }));
      }
    } catch {
      // ignore — TTL prune will reclaim stale dirs
    }
  }
}
