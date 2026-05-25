/**
 * Rewrites absolute asset paths in HTML to go through the preview proxy.
 * Includes RSC flight payloads in inline scripts (Next.js injects CSS URLs there too).
 */
export function rewriteHtmlAssetPaths(html: string, projectId: string): string {
  const proxyBase = `/api/projects/${projectId}/preview/proxy`;
  const pb = proxyBase;

  html = html.replace(/href="(\/_next\/[^"]*)"/g, `href="${pb}$1"`);
  html = html.replace(/src="(\/_next\/[^"]*)"/g, `src="${pb}$1"`);
  html = html.replace(/href='(\/_next\/[^']*)'/g, `href='${pb}$1'`);
  html = html.replace(/src='(\/_next\/[^']*)'/g, `src='${pb}$1'`);

  html = html.replace(/href="(\/favicon\.ico)"/g, `href="${pb}$1"`);
  html = html.replace(/src="(\/favicon\.ico)"/g, `src="${pb}$1"`);

  html = html.replace(/"\/_next\//g, `"${pb}/_next/`);
  html = html.replace(/'\/_next\//g, `'${pb}/_next/`);

  html = html.replace(/href="(\/[^"][^"]*)"/g, (m, path) => {
    if (
      path.startsWith('//') ||
      path.startsWith('http') ||
      path.startsWith('mailto:') ||
      path.startsWith('tel:') ||
      path.startsWith('data:') ||
      path.startsWith('blob:')
    ) {
      return m;
    }
    if (path.startsWith(proxyBase)) return m;
    return `href="${pb}${path}"`;
  });
  html = html.replace(/src="(\/[^"][^"]*)"/g, (m, path) => {
    if (
      path.startsWith('//') ||
      path.startsWith('http') ||
      path.startsWith('mailto:') ||
      path.startsWith('tel:') ||
      path.startsWith('data:') ||
      path.startsWith('blob:')
    ) {
      return m;
    }
    if (path.startsWith(proxyBase)) return m;
    return `src="${pb}${path}"`;
  });

  return html;
}
