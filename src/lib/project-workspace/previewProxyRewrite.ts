function shouldSkipPath(path: string, proxyBase: string): boolean {
  return (
    path.startsWith('//') ||
    path.startsWith('http') ||
    path.startsWith('mailto:') ||
    path.startsWith('tel:') ||
    path.startsWith('data:') ||
    path.startsWith('blob:') ||
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

/** @deprecated Use rewritePreviewAssetPaths */
export function rewriteHtmlAssetPaths(html: string, projectId: string): string {
  return rewritePreviewAssetPaths(html, projectId);
}
