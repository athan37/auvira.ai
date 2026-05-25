/**
 * Waits for a preview server to respond with HTTP 200-399.
 * Polls every intervalMs until timeoutMs is reached.
 */
export async function waitForPreviewReady(
  url: string,
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<void> {
  const { timeoutMs = 60000, intervalMs = 1000 } = options;
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const http = require('http');

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

    check();
  });
}