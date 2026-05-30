import { describe, it, expect } from 'vitest';
import {
  extractBackgroundColorFromMessage,
  extractColorTokenAfterTo,
  isGradientBackgroundRequest,
  parseColorSwap,
  swapTailwindColorInText,
} from '../../src/lib/project-workspace/website-edit-agent/preset/presetUtils';
import {
  extractSectionBackgroundClassFromMessage,
  resolveGradientBackgroundClass,
} from '../../src/lib/builder/sectionPresentation';
import { htmlShowsTailwindColor } from '../../src/lib/project-workspace/verifyPreviewHints';

describe('presetUtils', () => {
  it('parseColorSwap extracts from/to', () => {
    expect(parseColorSwap('from red to yellow')).toEqual({
      fromColor: 'red',
      toColor: 'yellow',
    });
    expect(parseColorSwap('change background to blue to yellow gradient')).toEqual({
      fromColor: 'blue',
      toColor: 'yellow',
    });
    expect(parseColorSwap('change background to blue to orange gradient')).toEqual({
      fromColor: 'blue',
      toColor: 'orange',
    });
  });

  it('swapTailwindColorInText replaces bg and text classes', () => {
    const out = swapTailwindColorInText('bg-red-600 text-red-100 from-red-800', 'red', 'yellow');
    expect(out).toContain('bg-yellow-600');
    expect(out).toContain('text-yellow-100');
    expect(out).toContain('from-yellow-800');
  });

  it('htmlShowsTailwindColor matches text-black', () => {
    expect(htmlShowsTailwindColor('<h1 class="text-black">Hi</h1>', 'black')).toBe(true);
  });

  it('extractBackgroundColorFromMessage ignores quoted section titles', () => {
    const message =
      'change this section background to blue "Everything You Need to Grow Your Business"';
    expect(extractBackgroundColorFromMessage(message)).toBe('blue');
  });

  it('extractBackgroundColorFromMessage skips "color gradient" filler before quoted title', () => {
    const message =
      'change this section background to color gradient "Everything You Need to Grow Your Business"';
    expect(extractBackgroundColorFromMessage(message)).toBeNull();
    expect(extractColorTokenAfterTo(message)).toBeNull();
  });

  it('extractBackgroundColorFromMessage returns null for gradient-only phrasing', () => {
    expect(extractBackgroundColorFromMessage('make it a blue gradient background')).toBeNull();
    expect(extractBackgroundColorFromMessage('change section to gradient background blue')).toBeNull();
  });

  it('extractBackgroundColorFromMessage resolves flat black and white', () => {
    expect(extractBackgroundColorFromMessage('change background to black')).toBe('black');
    expect(extractBackgroundColorFromMessage('make section background white')).toBe('white');
  });

  it('extractColorTokenAfterTo skips filler words after to', () => {
    expect(extractColorTokenAfterTo('change background to color red')).toBe('red');
    expect(extractColorTokenAfterTo('change background to a dark blue')).toBe('dark blue');
    expect(extractColorTokenAfterTo('change background to gradient orange')).toBe('orange');
  });

  it('extractSectionBackgroundClassFromMessage resolves gradient classes with explicit hue', () => {
    expect(isGradientBackgroundRequest('make it a blue gradient background')).toBe(true);
    expect(extractSectionBackgroundClassFromMessage('make it a blue gradient background')).toBe(
      resolveGradientBackgroundClass('make it a blue gradient background')
    );
    expect(resolveGradientBackgroundClass('change section to gradient background blue')).toBe(
      resolveGradientBackgroundClass('make it a blue gradient background')
    );
  });
});
