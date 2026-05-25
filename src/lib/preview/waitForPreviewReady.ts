/** True when the TCP server answered (any HTTP status — used for next dev still compiling or error pages). */
function isListeningStatus(code: number): boolean {
  return code > 0 && code < 600;
}

/** Quick HTTP health check for sandbox or public preview URLs. */
export async function checkPreviewUrlHealthy(url: string, timeoutMs = 8000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const ok = await probePreviewUrl(url, controller.signal);
    clearTimeout(timer);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Waits for a preview server to respond with HTTP 200-399.
 * Polls every intervalMs until timeoutMs is reached.
 */
async function probePreviewUrl(
  url: string,
  signal?: AbortSignal,
  options?: { acceptAnyHttpStatus?: boolean }
): Promise<boolean> {
  const ok = (code: number) =>
    options?.acceptAnyHttpStatus
      ? isListeningStatus(code)
      : (code >= 200 && code < 400) || code === 307 || code === 308;

  if (url.startsWith('https://') || (url.startsWith('http://') && !url.includes('127.0.0.1'))) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal });
      return ok(res.status);
    } catch {
      return false;
    }
  }
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(url, (res: { statusCode?: number }) => {
      resolve(ok(res.statusCode ?? 0));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

export async function waitForPreviewReady(
  url: string,
  options: { timeoutMs?: number; intervalMs?: number; acceptAnyHttpStatus?: boolean } = {}
): Promise<void> {
  const { timeoutMs = 60000, intervalMs = 1000, acceptAnyHttpStatus = false } = options;
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const http = require('http');
    const useFetch =
      url.startsWith('https://') || (url.startsWith('http://') && !url.includes('127.0.0.1'));

    async function checkFetch() {
      if (Date.now() > deadline) {
        reject(new Error(`Preview server at ${url} did not respond within ${timeoutMs}ms`));
        return;
      }
      const ready = await probePreviewUrl(url, undefined, { acceptAnyHttpStatus });
      if (ready) resolve();
      else setTimeout(checkFetch, intervalMs);
    }

    function check() {
      if (Date.now() > deadline) {
        reject(new Error(`Preview server at ${url} did not respond within ${timeoutMs}ms`));
        return;
      }

      const req = http.get(url, (res: any) => {
        const code = res.statusCode ?? 0;
        const ready = acceptAnyHttpStatus
          ? isListeningStatus(code)
          : (code >= 200 && code < 400) || code === 307 || code === 308;
        if (ready) resolve();
        else scheduleNext();
      });

      req.on('error', () => {
        scheduleNext();
      });

      req.setTimeout(5000, () => {
        req.destroy();
        scheduleNext();
      });
    }

    function scheduleNext() {
      const wait = Math.min(intervalMs, deadline - Date.now());
      if (wait <= 0) {
        reject(new Error(`Preview server at ${url} did not respond within ${timeoutMs}ms`));
        return;
      }
      setTimeout(check, wait);
    }

    if (useFetch) {
      void checkFetch();
    } else {
      check();
    }
  });
}