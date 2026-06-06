/**
 * Browser bundle entry for modern-screenshot used by the preview iframe bridge.
 * Built to src/lib/preview/generated/domBitmapCapture.bundle.js via scripts/build-preview-dom-capture.mjs
 */
import { domToPng } from 'modern-screenshot';

export interface DomBitmapCaptureOptions {
  width: number;
  height: number;
  scale: number;
  timeout?: number;
  backgroundColor?: string | null;
}

/** Rasterize a DOM node to a PNG data URL. */
export async function domToPngDataUrl(
  element: HTMLElement,
  options: DomBitmapCaptureOptions
): Promise<string> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }
  return domToPng(element, {
    width: options.width,
    height: options.height,
    scale: options.scale,
    quality: 1,
    type: 'image/png',
    timeout: options.timeout ?? 800,
    backgroundColor: options.backgroundColor ?? null,
  });
}
