import { describe, it, expect } from 'vitest';
import {
  extractPreviewVerifyHints,
  htmlShowsTailwindColor,
} from '../../src/lib/project-workspace/verifyPreviewHints';

describe('verifyPreviewHints', () => {
  it('extracts color and style intent from background prompt', () => {
    const hints = extractPreviewVerifyHints('change background color of the site to green');
    expect(hints.colors).toContain('green');
    expect(hints.isStyleRequest).toBe(true);
  });

  it('extracts quoted phrases for copy verification', () => {
    const hints = extractPreviewVerifyHints('change headline to "Summer Sale Today"');
    expect(hints.phrases).toContain('Summer Sale Today');
    expect(hints.isCopyRequest).toBe(true);
  });

  it('detects gradient green classes in HTML', () => {
    const html =
      '<main class="bg-gradient-to-br from-green-800 via-green-700 to-green-900">x</main>';
    expect(htmlShowsTailwindColor(html, 'green')).toBe(true);
  });

  it('detects bg-green solid classes', () => {
    expect(htmlShowsTailwindColor('<motion class="bg-green-600">', 'green')).toBe(true);
  });
});
