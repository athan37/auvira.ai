/**
 * Parse Next.js dev error overlay payload from an HTML error page (__NEXT_DATA__).
 */
export function extractPreviewCompileErrorFromHtml(html: string): string | null {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!match?.[1]) return null;

  try {
    const data = JSON.parse(match[1]) as {
      err?: { message?: string };
      props?: { pageProps?: { statusCode?: number } };
    };
    const raw = data.err?.message?.trim();
    if (!raw) return null;

    const fileRef = raw.match(/src\/app\/page\.tsx:(\d+):\d+/i);
    const snippet = raw.match(/,-\[[^\]]*page\.tsx:\d+:\d+\][\s\S]*?`----/);
    if (snippet) {
      const cleaned = snippet[0]
        .replace(/\u001b\[[0-9;]*m/g, '')
        .replace(/,-\[[^\]]+\]/, '')
        .replace(/`----/, '')
        .trim();
      const prefix = fileRef ? `src/app/page.tsx:${fileRef[1]} — ` : '';
      return (prefix + cleaned).slice(0, 1200);
    }
    return raw.split('\n').slice(0, 12).join('\n').slice(0, 1200);
  } catch {
    return null;
  }
}

/** Fetch a preview URL and return a compile/runtime error summary when present. */
export async function fetchPreviewCompileError(
  url: string,
  timeoutMs = 12_000
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    clearTimeout(timer);
    const html = await res.text();
    return extractPreviewCompileErrorFromHtml(html);
  } catch {
    return null;
  }
}

export async function describeUnhealthyPreviewUrl(
  url: string,
  baseMessage: string
): Promise<string> {
  const compile = await fetchPreviewCompileError(url);
  if (!compile) return baseMessage;
  return `${baseMessage} — ${compile.replace(/\s+/g, ' ').trim()}`;
}
