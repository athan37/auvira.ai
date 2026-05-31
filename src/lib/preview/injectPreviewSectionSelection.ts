/**
 * Inject preview section bridge into proxied HTML (editor-only).
 */

import {
  PREVIEW_SECTION_BRIDGE_VERSION,
  PREVIEW_SECTION_SELECTION_STYLES,
} from '@/lib/preview/sectionBridgeScript';

export const PREVIEW_SECTION_SELECTION_MARKER = 'preview-section-selection';

const SECTION_BRIDGE_SCRIPT_PATTERN =
  /<script id="preview-section-selection"[\s\S]*?<\/script>/gi;

function sectionBridgeScriptUrl(projectId: string): string {
  return `/api/projects/${projectId}/preview/section-bridge?v=${PREVIEW_SECTION_BRIDGE_VERSION}`;
}

/** Remove any prior section-bridge script/styles bundle. */
export function stripPreviewSectionSelection(html: string): string {
  return html
    .replace(SECTION_BRIDGE_SCRIPT_PATTERN, '')
    .replace(/<style id="preview-section-selection-styles"[\s\S]*?<\/style>/gi, '');
}

/** Inject external bridge script + styles into proxied HTML (replaces older bridge tags). */
export function injectPreviewSectionSelection(html: string, projectId: string): string {
  const scriptUrl = sectionBridgeScriptUrl(projectId);

  if (html.includes(scriptUrl) && html.includes('id="preview-section-selection-styles"')) {
    return html;
  }

  const out = stripPreviewSectionSelection(html);
  return injectBundle(out, scriptUrl);
}

function injectBundle(html: string, scriptUrl: string): string {
  const bundle = `${PREVIEW_SECTION_SELECTION_STYLES}<script id="${PREVIEW_SECTION_SELECTION_MARKER}" src="${scriptUrl}" defer></script>`;
  if (html.includes('</head>')) {
    return html.replace('</head>', `${bundle}</head>`);
  }
  return `${bundle}${html}`;
}

/** @deprecated Use buildSectionBridgeScriptBody from sectionBridgeScript.ts */
export { buildSectionBridgeScriptBody as buildPreviewSectionSelectionScript } from '@/lib/preview/sectionBridgeScript';

/** @deprecated Styles moved to sectionBridgeScript.ts */
export { PREVIEW_SECTION_SELECTION_STYLES } from '@/lib/preview/sectionBridgeScript';

export { PREVIEW_SECTION_BRIDGE_VERSION as PREVIEW_SECTION_SELECTION_VERSION } from '@/lib/preview/sectionBridgeScript';
