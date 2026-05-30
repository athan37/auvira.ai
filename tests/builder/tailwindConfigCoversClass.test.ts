import { describe, it, expect } from 'vitest';
import { tailwindConfigCoversBackgroundClass } from '@/lib/builder/tailwindPresentationSupport';

describe('tailwindConfigCoversBackgroundClass', () => {
  const canonical = `module.exports = {
    content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
    safelist: [{ pattern: /^bg-red-(50|100|200|300|400|500|600|700|800|900)$/ }],
  };`;

  it('returns true when full src scan is configured', () => {
    expect(tailwindConfigCoversBackgroundClass(canonical, 'bg-red-600')).toBe(true);
  });

  it('returns false for minimal config without scan or safelist match', () => {
    const minimal = 'module.exports = { content: ["./src/app/**/*"] };';
    expect(tailwindConfigCoversBackgroundClass(minimal, 'bg-red-600')).toBe(false);
  });
});
