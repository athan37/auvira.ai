export interface LiveSiteFetchResult {
  ok: boolean;
  status: number;
  html: string;
  error?: string;
}

export async function fetchLiveSite(url: string, timeoutMs = 15_000): Promise<LiveSiteFetchResult> {
  if (!url?.trim()) return { ok: false, status: 0, html: '', error: 'No live URL configured' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SiteManagerWatch/1.0' },
      redirect: 'follow',
    });
    const html = await res.text();
    return { ok: res.ok, status: res.status, html, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, status: 0, html: '', error: err instanceof Error ? err.message : 'Fetch failed' };
  } finally {
    clearTimeout(timer);
  }
}
