/**
 * Waits for a preview server to respond with HTTP 200-399.
 * Polls every intervalMs until timeoutMs is reached.
 */
async function probePreviewUrl(url: string): Promise<boolean> {
  if (url.startsWith('https://') || (url.startsWith('http://') && !url.includes('127.0.0.1'))) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      return res.status >= 200 && res.status < 400;
    } catch {
      return false;
    }
  }
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(url, (res: { statusCode?: number }) => {
      resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 400);
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
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<void> {
  const { timeoutMs = 60000, intervalMs = 1000 } = options;
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
      const ok = await probePreviewUrl(url);
      if (ok) resolve();
      else setTimeout(checkFetch, intervalMs);
    }

    function check() {
      if (Date.now() > deadline) {
        reject(new Error(`Preview server at ${url} did not respond within ${timeoutMs}ms`));
        return;
      }

      const req = http.get(url, (res: any) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
        } else {
          scheduleNext();
        }
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