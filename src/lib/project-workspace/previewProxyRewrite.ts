import { injectPreviewSectionSelection } from '@/lib/preview/injectPreviewSectionSelection';

const PREVIEW_REWRITE_CONTENT_TYPES = [
  'text/html',
  'text/css',
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
] as const;

/** True when proxied response body should rewrite absolute /_next/ asset paths. */
export function isPreviewRewriteableContentType(contentType: string): boolean {
  const ct = contentType.toLowerCase();
  return PREVIEW_REWRITE_CONTENT_TYPES.some((kind) => ct.includes(kind));
}

function shouldSkipPath(path: string, proxyBase: string): boolean {
  return (
    path.startsWith('//') ||
    path.startsWith('http') ||
    path.startsWith('mailto:') ||
    path.startsWith('tel:') ||
    path.startsWith('data:') ||
    path.startsWith('blob:') ||
    path.startsWith('/api/projects/') ||
    path.startsWith(proxyBase)
  );
}

/**
 * Rewrites absolute asset paths so they load through the preview proxy.
 * Used for HTML and CSS from the workspace Next.js dev server.
 */
export function rewritePreviewAssetPaths(content: string, projectId: string): string {
  const proxyBase = `/api/projects/${projectId}/preview/proxy`;
  const pb = proxyBase;

  content = content.replace(/href="(\/_next\/[^"]*)"/g, `href="${pb}$1"`);
  content = content.replace(/src="(\/_next\/[^"]*)"/g, `src="${pb}$1"`);
  content = content.replace(/href='(\/_next\/[^']*)'/g, `href='${pb}$1'`);
  content = content.replace(/src='(\/_next\/[^']*)'/g, `src='${pb}$1'`);

  content = content.replace(/href="(\/favicon\.ico)"/g, `href="${pb}$1"`);
  content = content.replace(/src="(\/favicon\.ico)"/g, `src="${pb}$1"`);

  content = content.replace(/"\/_next\//g, `"${pb}/_next/`);
  content = content.replace(/'\/_next\//g, `'${pb}/_next/`);
  content = content.replace(/"\/uploads\//g, `"${pb}/uploads/`);
  content = content.replace(/'\/uploads\//g, `'${pb}/uploads/`);

  content = content.replace(
    /url\(\s*(['"]?)(\/uploads\/[^'")]+)\1\s*\)/g,
    (_m, quote, path) => `url(${quote || ''}${pb}${path}${quote || ''})`
  );

  content = content.replace(/href="(\/[^"]+)"/g, (m, path) => {
    if (shouldSkipPath(path, proxyBase)) return m;
    return `href="${pb}${path}"`;
  });
  content = content.replace(/src="(\/[^"]+)"/g, (m, path) => {
    if (shouldSkipPath(path, proxyBase)) return m;
    return `src="${pb}${path}"`;
  });
  content = content.replace(/srcset="([^"]+)"/gi, (m, srcset) => {
    const rewritten = srcset.replace(/(^|,)\s*(\/[^\s,]+)/g, (part: string, sep: string, path: string) => {
      if (shouldSkipPath(path, proxyBase)) return part;
      return `${sep} ${pb}${path}`;
    });
    return rewritten === srcset ? m : `srcset="${rewritten}"`;
  });

  return content;
}

/** Rewrite workspace dev-server redirect targets so the iframe stays on the preview proxy. */
export function rewritePreviewLoopbackLocation(
  location: string,
  projectId: string,
  previewPort: number
): string {
  try {
    const parsed = location.startsWith('http')
      ? new URL(location)
      : new URL(location, `http://127.0.0.1:${previewPort}`);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return location;
    }
    const port = parsed.port ? Number(parsed.port) : previewPort;
    if (port !== previewPort) {
      return location;
    }
    const proxyBase = `/api/projects/${projectId}/preview/proxy`;
    return `${proxyBase}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return location;
  }
}

/** Rewrite absolute loopback asset URLs in proxied HTML/CSS/JS. */
export function rewritePreviewLoopbackAssetUrls(
  content: string,
  projectId: string,
  previewPort: number
): string {
  const proxyBase = `/api/projects/${projectId}/preview/proxy`;
  const portPattern = String(previewPort);
  const hosts = ['localhost', '127\\.0\\.0\\.1'];
  for (const host of hosts) {
    const absolute = new RegExp(
      `(https?:\\/\\/${host}:${portPattern})(\\/[^"'\\s)]+)`,
      'g'
    );
    content = content.replace(absolute, `${proxyBase}$2`);
  }
  return content;
}

const CHUNK_ERROR_RECOVERY_SCRIPT = `<script>(function(){var retried=false;function notify(){try{window.parent.postMessage({type:"preview-chunk-error"},"*");}catch(e){}}function isChunkErr(m){return typeof m==="string"&&(m.indexOf("ChunkLoadError")>=0||m.indexOf("Loading chunk")>=0);}window.addEventListener("error",function(e){if(isChunkErr(e.message)||isChunkErr(String(e.error||"")))notify();});window.addEventListener("unhandledrejection",function(e){var r=e.reason;var m=r&&r.message?r.message:String(r||"");if(isChunkErr(m))notify();});})();</script>`;

/** Inject parent-frame chunk error recovery hook into proxied HTML. */
export function injectPreviewChunkErrorRecovery(html: string): string {
  if (html.includes('preview-chunk-error')) return html;
  if (html.includes('</head>')) {
    return html.replace('</head>', `${CHUNK_ERROR_RECOVERY_SCRIPT}</head>`);
  }
  return `${CHUNK_ERROR_RECOVERY_SCRIPT}${html}`;
}

/** Rewrite proxied workspace response when content type carries absolute asset paths. */
export function rewritePreviewResponseBody(
  body: Buffer,
  contentType: string,
  projectId: string,
  previewPort?: number
): { body: Buffer | string; rewritten: boolean; contentType: string } {
  if (!isPreviewRewriteableContentType(contentType) || body.length === 0) {
    return { body, rewritten: false, contentType };
  }

  const text = body.toString('utf8');
  let rewritten = rewritePreviewAssetPaths(text, projectId);
  if (previewPort) {
    rewritten = rewritePreviewLoopbackAssetUrls(rewritten, projectId, previewPort);
  }
  let didRewrite = rewritten !== text;

  if (contentType.includes('text/html')) {
    const beforeInject = rewritten;
    rewritten = injectPreviewChunkErrorRecovery(rewritten);
    rewritten = injectPreviewSectionSelection(rewritten, projectId);
    didRewrite = didRewrite || rewritten !== beforeInject;
  }

  if (!didRewrite) {
    return { body, rewritten: false, contentType };
  }

  const normalizedType = contentType.includes('text/html')
    ? 'text/html; charset=utf-8'
    : contentType.includes('text/css')
      ? 'text/css; charset=utf-8'
      : contentType.includes('javascript')
        ? 'application/javascript; charset=utf-8'
        : contentType;

  return { body: rewritten, rewritten: true, contentType: normalizedType };
}

/** @deprecated Use rewritePreviewAssetPaths */
export function rewriteHtmlAssetPaths(html: string, projectId: string): string {
  return rewritePreviewAssetPaths(html, projectId);
}
