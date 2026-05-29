import { describe, it, expect } from 'vitest';
import {
  customerSiteTailwindConfigIsComplete,
  normalizeCustomerSiteTailwindConfig,
  tailwindContentPathsForGeneratedSite,
} from '@/lib/builder/tailwindPresentationSupport';
import { generateTailwindConfig } from '@/lib/builder/templates';

const LEGACY_TAILWIND = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;

describe('tailwindPresentationSupport', () => {
  it('generated tailwind config scans all of src and has safelist', () => {
    const generated = generateTailwindConfig();
    expect(customerSiteTailwindConfigIsComplete(generated)).toBe(true);
    expect(generated).toContain('./src/**/*');
    expect(generated).toContain('safelist');
  });

  it('tailwindContentPathsForGeneratedSite uses src catch-all', () => {
    expect(tailwindContentPathsForGeneratedSite()).toContain('./src/**/*');
  });

  it('normalizes legacy tailwind to canonical content + safelist', () => {
    const { content: patched, changed } = normalizeCustomerSiteTailwindConfig(LEGACY_TAILWIND);
    expect(changed).toBe(true);
    expect(patched).toContain('./src/**/*');
    expect(patched).toContain('./src/app/**/*');
    expect(patched).toContain('safelist');
    expect(patched).toMatch(/yellow\|blue/);
    expect(patched).not.toContain('],,');
  });

  it('preserves existing content globs when upgrading Jobber-style config', () => {
    const jobberStyle = `module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: { extend: {} },
  plugins: [],
}`;
    const { content: patched, changed } = normalizeCustomerSiteTailwindConfig(jobberStyle);
    expect(changed).toBe(true);
    expect(patched).toContain('./src/pages/**/*');
    expect(patched).toContain('./src/components/**/*');
    expect(patched).toContain('./src/app/**/*');
    expect(patched).toContain('./src/**/*');
    expect(patched).toContain('safelist');
  });

  it('normalize is idempotent on canonical config', () => {
    const canonical = generateTailwindConfig();
    const { changed } = normalizeCustomerSiteTailwindConfig(canonical);
    expect(changed).toBe(false);
  });
});
