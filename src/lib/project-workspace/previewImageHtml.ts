/**
 * Detect uploaded image references in preview HTML / RSC payloads.
 */
export function htmlContainsUploadedImage(html: string, publicUrl: string): boolean {
  const path = publicUrl.startsWith('/') ? publicUrl : `/${publicUrl}`;
  const noLead = path.replace(/^\//, '');
  const base = noLead.split('/').pop() ?? '';
  if (!base || base.length < 3) return false;

  const needles = [
    path,
    noLead,
    `uploads/${base}`,
    encodeURIComponent(path),
    encodeURIComponent(noLead),
    `"imageUrl":"${path}"`,
    `"imageUrl": "${path}"`,
    `'imageUrl':'${path}'`,
    `imageUrl\\":\\"${path.replace(/\//g, '\\/')}"`,
    `imageUrl\\":\\"${path}"`,
    base,
  ];

  return needles.some((n) => n.length > 3 && html.includes(n));
}

/** Count attachments whose public URL (or basename) appears in HTML. */
export function countUploadedImagesInHtml(
  html: string,
  publicUrls: string[]
): number {
  return publicUrls.filter((url) => htmlContainsUploadedImage(html, url)).length;
}
