import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  schedulePreviewIframeReloads,
  workspaceEditNeedsPreviewReload,
} from '@/lib/project-workspace/previewReloadAfterEdit';

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

  describe('schedulePreviewIframeReloads', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not schedule when preview already synced', () => {
      const bump = vi.fn();
      schedulePreviewIframeReloads(bump, {
        previewSynced: true,
        changedPaths: ['src/lib/siteConfig.ts'],
      });
      vi.runAllTimers();
      expect(bump).not.toHaveBeenCalled();
    });

    it('schedules two delayed bumps when preview is still syncing', () => {
      const bump = vi.fn();
      schedulePreviewIframeReloads(bump, {
        previewSynced: false,
        changedPaths: ['src/lib/siteConfig.ts'],
      });
      expect(bump).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2_500);
      expect(bump).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(7_000);
      expect(bump).toHaveBeenCalledTimes(2);
    });

    it('cancel clears pending bumps', () => {
      const bump = vi.fn();
      const { cancel } = schedulePreviewIframeReloads(bump, {
        previewSynced: false,
        changedPaths: ['src/app/page.tsx'],
      });
      cancel();
      vi.runAllTimers();
      expect(bump).not.toHaveBeenCalled();
    });
  });
});
