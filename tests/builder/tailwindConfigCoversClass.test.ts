import { describe, it, expect } from 'vitest';
import {
  isEmitableTailwindBackgroundClass,
  tailwindConfigCoversBackgroundClass,
} from '@/lib/builder/tailwindPresentationSupport';
import { buildBlackWhiteGradientBackgroundClass } from '@/lib/builder/gradientBuilder';

describe('tailwindConfigCoversBackgroundClass', () => {
  const canonical = `module.exports = {
    content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
    safelist: [{ pattern: /^bg-red-(50|100|200|300|400|500|600|700|800|900)$/ }],
  };`;

  const safelistWithFlat = `module.exports = {
    content: ["./src/app/**/*"],
    safelist: ['bg-black', 'bg-white', { pattern: /^bg-red-(50|100|200|300|400|500|600|700|800|900)$/ }],
  };`;

  it('returns true when full src scan is configured', () => {
    expect(tailwindConfigCoversBackgroundClass(canonical, 'bg-red-600')).toBe(true);
    expect(tailwindConfigCoversBackgroundClass(canonical, 'bg-black')).toBe(true);
  });

  it('returns false for minimal config without scan or safelist match', () => {
    const minimal = 'module.exports = { content: ["./src/app/**/*"] };';
    expect(tailwindConfigCoversBackgroundClass(minimal, 'bg-red-600')).toBe(false);
    expect(tailwindConfigCoversBackgroundClass(minimal, 'bg-black')).toBe(false);
  });

  it('covers flat black/white via explicit safelist entries', () => {
    expect(tailwindConfigCoversBackgroundClass(safelistWithFlat, 'bg-black')).toBe(true);
    expect(tailwindConfigCoversBackgroundClass(safelistWithFlat, 'bg-white')).toBe(true);
  });

  it('rejects invalid shaded black/white utilities', () => {
    expect(isEmitableTailwindBackgroundClass('bg-black-600')).toBe(false);
    expect(isEmitableTailwindBackgroundClass('bg-white-600')).toBe(false);
    expect(tailwindConfigCoversBackgroundClass(canonical, 'bg-black-600')).toBe(false);
  });

  it('rejects invalid gradient stops on flat colors', () => {
    expect(
      isEmitableTailwindBackgroundClass(
        'bg-gradient-to-br from-white-400 via-white-600 to-white-900'
      )
    ).toBe(false);
    expect(
      isEmitableTailwindBackgroundClass(buildBlackWhiteGradientBackgroundClass())
    ).toBe(true);
  });
});
