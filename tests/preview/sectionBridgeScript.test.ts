import { describe, expect, it } from 'vitest';
import {
  PREVIEW_SECTION_BRIDGE_VERSION,
  PREVIEW_SECTION_SELECTION_STYLES,
  buildSectionBridgeScriptBody,
} from '@/lib/preview/sectionBridgeScript';

describe('sectionBridgeScript v25 scaled thumb capture', () => {
  it('bumps bridge version for fixed-size scaled thumbnails', () => {
    expect(PREVIEW_SECTION_BRIDGE_VERSION).toBeGreaterThanOrEqual(25);
  });

  it('prefers styled element capture over SVG raster for element pins', () => {
    const body = buildSectionBridgeScriptBody();
    expect(body).toContain('function captureElementStyledPreview');
    expect(body).toContain('captureElementStyledPreview(root,leafKind)');
    expect(body).toContain('function inlineComputedStyles');
  });

  it('includes iframe mousemove drag threshold and DRAG_START emit', () => {
    const body = buildSectionBridgeScriptBody();
    expect(body).toContain('document.addEventListener("mousemove"');
    expect(body).toContain('DRAG_THRESHOLD*DRAG_THRESHOLD');
    expect(body).toContain('MSG.DRAG_START');
  });

  it('supports nav and section draggable roots', () => {
    const body = buildSectionBridgeScriptBody();
    expect(body).toContain('function findDraggableRoot');
    expect(body).toContain('rootType==="nav"');
    expect(body).toContain('findDraggableRoot(e.target)');
  });

  it('extends grab cursor to main links and headings', () => {
    expect(PREVIEW_SECTION_SELECTION_STYLES).toContain('main a');
    expect(PREVIEW_SECTION_SELECTION_STYLES).toContain('nav a');
  });

  it('includes item grid expansion and card annotation helpers', () => {
    const body = buildSectionBridgeScriptBody();
    expect(body).toContain('function annotateItemCard');
    expect(body).toContain('function expandItemGridTarget');
    expect(body).toContain('kind:"item_card"');
    expect(body).toContain('expandItemGridTarget(el,target,elementNodes,idx)');
  });

  it('includes full-section preview capture for nested contact layouts', () => {
    const body = buildSectionBridgeScriptBody();
    expect(body).toContain('function resolvePreviewCaptureRoot');
    expect(body).toContain('function captureSectionStyledFallback');
    expect(body).toContain('shouldCaptureFullSectionPreview');
  });
});
