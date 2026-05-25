/**
 * Best-effort scratch release when the owner navigates away from the project editor.
 * Uses keepalive fetch so the request can finish after unmount.
 *
 * Release is scheduled with a short delay so React Strict Mode remounts (dev) do not
 * delete the workspace while the user is still on the project page.
 */

const RELEASE_DELAY_MS = 3000;
const pendingReleases = new Map<string, ReturnType<typeof setTimeout>>();

export function cancelScheduledWorkspaceRelease(projectId: string): void {
  const timer = pendingReleases.get(projectId);
  if (timer) {
    clearTimeout(timer);
    pendingReleases.delete(projectId);
  }
}

/** Call when the project editor mounts or the user returns to the page. */
export function cancelWorkspaceReleaseOnEnter(projectId: string): void {
  cancelScheduledWorkspaceRelease(projectId);
}

/**
 * Schedule release after leaving. Cancelled if the user returns before the delay
 * (e.g. Strict Mode remount or quick navigation back).
 */
export function scheduleWorkspaceReleaseOnLeave(projectId: string): void {
  if (!projectId || typeof window === 'undefined') return;

  cancelScheduledWorkspaceRelease(projectId);
  const timer = setTimeout(() => {
    pendingReleases.delete(projectId);
    releaseWorkspaceNow(projectId);
  }, RELEASE_DELAY_MS);
  pendingReleases.set(projectId, timer);
}

/** @deprecated Prefer scheduleWorkspaceReleaseOnLeave — immediate release for tests. */
export function releaseWorkspaceOnLeave(projectId: string): void {
  cancelScheduledWorkspaceRelease(projectId);
  releaseWorkspaceNow(projectId);
}

function releaseWorkspaceNow(projectId: string): void {
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
