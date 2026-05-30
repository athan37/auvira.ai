import { describe, it, expect } from 'vitest';
import {
  extractBackgroundColorFromMessage,
  parseColorSwap,
  swapTailwindColorInText,
} from '../../src/lib/project-workspace/website-edit-agent/preset/presetUtils';
import { htmlShowsTailwindColor } from '../../src/lib/project-workspace/verifyPreviewHints';

describe('presetUtils', () => {
  it('parseColorSwap extracts from/to', () => {
    expect(parseColorSwap('from red to yellow')).toEqual({
      fromColor: 'red',
      toColor: 'yellow',
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
});
