import { describe, it, expect } from 'vitest';
import {
  isPreviewSafeChangedFile,
  isPreviewSafeEdit,
} from '@/lib/project-workspace/previewSafeValidation';

describe('previewSafeValidation', () => {
  it('treats tailwind and next/postcss config as preview-safe', () => {
    expect(isPreviewSafeChangedFile('tailwind.config.js')).toBe(true);
    expect(isPreviewSafeChangedFile('tailwind.config.ts')).toBe(true);
    expect(isPreviewSafeChangedFile('postcss.config.js')).toBe(true);
    expect(isPreviewSafeChangedFile('next.config.js')).toBe(true);
    expect(isPreviewSafeChangedFile('next.config.mjs')).toBe(true);
  });

  it('treats src TSX/CSS as preview-safe', () => {
    expect(isPreviewSafeChangedFile('src/app/page.tsx')).toBe(true);
    expect(isPreviewSafeChangedFile('src/lib/siteConfig.ts')).toBe(true);
  });

  it('rejects lockfiles and non-src paths for preview-safe edits', () => {
    expect(isPreviewSafeChangedFile('package.json')).toBe(false);
    expect(isPreviewSafeChangedFile('README.md')).toBe(false);
    expect(isPreviewSafeEdit(['tailwind.config.js'])).toBe(true);
    expect(isPreviewSafeEdit(['tailwind.config.js', 'src/lib/siteConfig.ts'])).toBe(true);
    expect(isPreviewSafeEdit(['package.json'])).toBe(false);
    expect(isPreviewSafeEdit(['tailwind.config.js', 'package-lock.json'])).toBe(false);
  });
});
