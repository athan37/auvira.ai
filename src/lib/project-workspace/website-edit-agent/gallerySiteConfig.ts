import type { WorkspaceAssetAttachment } from '../workspaceAssetTypes';

export function inferGallerySectionTitle(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('documentation') || lower.includes('document')) {
    return 'Product documentation';
  }
  if (lower.includes('product')) {
    return 'Our products';
  }
  if (lower.includes('gallery')) {
    return 'Gallery';
  }
  return 'Product images';
}

export function inferGallerySectionBody(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('important')) {
    return 'These are important images of our product.';
  }
  if (lower.includes('documentation')) {
    return 'Product documentation and reference images.';
  }
  return 'Browse our product images below.';
}

export function buildGallerySectionPayload(
  attachments: WorkspaceAssetAttachment[],
  ownerMessage: string
): Record<string, unknown> {
  return {
    type: 'documentation',
    title: inferGallerySectionTitle(ownerMessage),
    body: inferGallerySectionBody(ownerMessage),
    items: attachments.map((asset, index) => ({
      title: asset.originalName.replace(/\.[^.]+$/, '') || `Image ${index + 1}`,
      imageUrl: asset.publicUrl,
    })),
  };
}

/**
 * Insert gallery section at the top of siteConfig.sections so it appears just below the hero.
 */
export function prependGallerySectionInSiteConfig(
  siteConfigSource: string,
  section: Record<string, unknown>
): string {
  const lines = JSON.stringify(section, null, 2).split('\n');
  const indented = lines.map((line) => `    ${line}`).join('\n');

  const title = String(section.title ?? '');
  let out = siteConfigSource;
  if (title) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(
      new RegExp(
        `\\n    \\{\\n      "type": "(?:generic|documentation)",[\\s\\S]*?"title": "${escaped}"[\\s\\S]*?\\n    \\},?`,
        'g'
      ),
      ''
    );
  }

  if (!/"sections"\s*:\s*\[/.test(out)) {
    return out;
  }

  return out.replace(/"sections"\s*:\s*\[\s*\n?/, `"sections": [\n${indented},\n`);
}
