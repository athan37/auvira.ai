import { describe, it, expect } from 'vitest';
import { workspaceEditNeedsPreviewReload } from '@/lib/project-workspace/previewReloadAfterEdit';

describe('previewReloadAfterEdit', () => {
  it('detects siteConfig and page.tsx edits', () => {
    expect(
      workspaceEditNeedsPreviewReload(['src/lib/siteConfig.ts', 'README.md'])
    ).toBe(true);
    expect(workspaceEditNeedsPreviewReload(['src/app/page.tsx'])).toBe(true);
    expect(workspaceEditNeedsPreviewReload(['tailwind.config.js'])).toBe(true);
  });

  it('ignores unrelated paths', () => {
    expect(workspaceEditNeedsPreviewReload(['public/logo.png'])).toBe(false);
  });
});
