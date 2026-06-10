import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPreviewReloadDelaysMs,
  getSinglePreviewReloadDelayMs,
  PREVIEW_IFRAME_SETTLE_MS,
  PREVIEW_UNSYNCED_EXTRA_MS,
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

  describe('getSinglePreviewReloadDelayMs', () => {
    it('reloads immediately when preview is synced', () => {
      expect(getSinglePreviewReloadDelayMs({ previewSynced: true })).toBe(PREVIEW_IFRAME_SETTLE_MS);
      expect(PREVIEW_IFRAME_SETTLE_MS).toBe(0);
    });

    it('adds extra delay when preview is still syncing', () => {
      expect(getSinglePreviewReloadDelayMs({ previewSynced: false })).toBe(
        PREVIEW_IFRAME_SETTLE_MS + PREVIEW_UNSYNCED_EXTRA_MS
      );
    });
  });

  describe('schedulePreviewIframeReloads', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('schedules one immediate reload when preview is synced', () => {
      const bump = vi.fn();
      schedulePreviewIframeReloads(bump, {
        previewSynced: true,
        changedPaths: ['src/lib/siteConfig.ts'],
      });
      expect(bump).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(bump).toHaveBeenCalledTimes(1);
    });

    it('schedules one delayed reload when preview is still syncing', () => {
      const bump = vi.fn();
      schedulePreviewIframeReloads(bump, {
        previewSynced: false,
        changedPaths: ['src/lib/siteConfig.ts'],
      });
      expect(bump).not.toHaveBeenCalled();
      vi.advanceTimersByTime(PREVIEW_UNSYNCED_EXTRA_MS - 1);
      expect(bump).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(bump).toHaveBeenCalledTimes(1);
      vi.runAllTimers();
      expect(bump).toHaveBeenCalledTimes(1);
    });

    it('exposes single settle-aware reload delay', () => {
      expect(getPreviewReloadDelaysMs()).toEqual([PREVIEW_IFRAME_SETTLE_MS]);
    });

    it('does not schedule when reload is deferred', () => {
      const bump = vi.fn();
      schedulePreviewIframeReloads(bump, {
        previewSynced: false,
        changedPaths: ['src/lib/siteConfig.ts'],
        deferReload: true,
      });
      vi.runAllTimers();
      expect(bump).not.toHaveBeenCalled();
    });

    it('cancel clears pending bump', () => {
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
