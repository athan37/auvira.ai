import { describe, expect, it } from 'vitest';
import {
  injectPreviewSectionSelection,
  PREVIEW_SECTION_SELECTION_MARKER,
  PREVIEW_SECTION_SELECTION_VERSION,
  stripPreviewSectionSelection,
} from '@/lib/preview/injectPreviewSectionSelection';

const projectId = 'test-project';

describe('injectPreviewSectionSelection', () => {
  it('injects external section-bridge script once into HTML head', () => {
    const html = '<html><head></head><body></body></html>';
    const once = injectPreviewSectionSelection(html, projectId);
    expect(once).toContain(PREVIEW_SECTION_SELECTION_MARKER);
    expect(once).toContain(`/api/projects/${projectId}/preview/section-bridge?v=${PREVIEW_SECTION_SELECTION_VERSION}`);
    expect(once).toContain('cursor:grab');
    const twice = injectPreviewSectionSelection(once, projectId);
    expect(twice).toBe(once);
  });

  it('replaces an older section-bridge script tag with the current version', () => {
    const legacy = `<html><head><script id="preview-section-selection" src="/api/projects/${projectId}/preview/section-bridge?v=1" defer></script></head><body></body></html>`;
    const upgraded = injectPreviewSectionSelection(legacy, projectId);
    expect(upgraded).toContain(`section-bridge?v=${PREVIEW_SECTION_SELECTION_VERSION}`);
    expect(upgraded).not.toMatch(/section-bridge\?v=1"/);
    expect((upgraded.match(/<script id="preview-section-selection"/g) ?? []).length).toBe(1);
  });

  it('stripPreviewSectionSelection removes prior bridge script tags', () => {
    const html = `<html><head><script id="preview-section-selection" src="/x" defer></script><style id="preview-section-selection-styles">x</style></head></html>`;
    const stripped = stripPreviewSectionSelection(html);
    expect(stripped).not.toContain('<script id="preview-section-selection"');
    expect(stripped).not.toContain('preview-section-selection-styles');
  });
});
