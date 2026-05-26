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

  it('detects text-black classes in HTML', () => {
    const html =
      '<h1 class="font-serif text-5xl font-semibold tracking-tight text-black md:text-7xl">Hero</h1>';
    expect(htmlShowsTailwindColor(html, 'black')).toBe(true);
  });

  it('classifies hero headline black as text-color request', () => {
    const hints = extractPreviewVerifyHints('Change the hero headline to black');
    expect(hints.colors).toContain('black');
    expect(hints.isTextColorRequest).toBe(true);
    expect(hints.isBackgroundColorRequest).toBe(false);
    expect(hints.isCopyRequest).toBe(true);
  });

  it('classifies background green as background-color request', () => {
    const hints = extractPreviewVerifyHints('change background color of the site to green');
    expect(hints.isTextColorRequest).toBe(false);
    expect(hints.isBackgroundColorRequest).toBe(true);
  });
});
