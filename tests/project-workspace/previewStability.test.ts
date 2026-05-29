import { describe, it, expect } from 'vitest';
import {
  isPreviewLoadingHtml,
  isSoftPreviewPendingFailure,
  resolveEditStreamPreviewOutcome,
} from '@/lib/project-workspace/previewStability';
import { buildPreviewLoadingHtml } from '@/lib/project-workspace/codePreviewServe';

describe('previewStability', () => {
  it('detects loading placeholder HTML', () => {
    const html = buildPreviewLoadingHtml('proj-1', 'Preview is starting');
    expect(isPreviewLoadingHtml(html)).toBe(true);
  });

  it('classifies timeout as soft pending', () => {
    expect(isSoftPreviewPendingFailure('Preview fetch failed: timeout')).toBe(true);
    expect(isSoftPreviewPendingFailure('fetch failed')).toBe(true);
  });

  it('returns success with previewSynced false when preview verify times out after source validation', () => {
    const outcome = resolveEditStreamPreviewOutcome({
      sourceValidationPassed: true,
      editApplied: true,
      previewVerify: { ok: false, reason: 'Preview fetch failed: timeout' },
      previewVerifySkipped: false,
      defaultSuccessMessage: 'Changed background to yellow.',
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.editApplied).toBe(true);
    expect(outcome.previewSynced).toBe(false);
    expect(outcome.previewVerifyStatus).toBe('pending');
    expect(outcome.ownerMessage).toContain('Preview is still syncing');
  });

  it('returns failure when source validation did not pass', () => {
    const outcome = resolveEditStreamPreviewOutcome({
      sourceValidationPassed: false,
      editApplied: false,
      previewVerify: { ok: false, reason: 'build failed' },
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.editApplied).toBe(false);
    expect(outcome.previewSynced).toBe(false);
    expect(outcome.previewVerifyStatus).toBe('failed');
  });

  it('returns synced when preview verification succeeds', () => {
    const outcome = resolveEditStreamPreviewOutcome({
      sourceValidationPassed: true,
      editApplied: true,
      previewVerify: { ok: true, reason: 'Preview HTML loaded after edit.' },
      previewVerifySkipped: false,
      defaultSuccessMessage: 'Changed background to yellow.',
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.previewSynced).toBe(true);
    expect(outcome.previewVerifyStatus).toBe('synced');
    expect(outcome.ownerMessage).toBe('Changed background to yellow.');
  });
});
