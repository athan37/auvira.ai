import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyEditVisibleInPreview } from '../../src/lib/project-workspace/verifyEditVisibleInPreview';

vi.mock('../../src/lib/preview/waitForPreviewReady', () => ({
  checkPreviewUrlHealthy: vi.fn().mockResolvedValue(true),
}));

describe('verifyEditVisibleInPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('honors custom retry count before giving up on missing images', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        calls += 1;
        return {
          ok: true,
          status: 200,
          text: async () => '<html>' + 'x'.repeat(2000) + '</html>',
        };
      })
    );

    const promise = verifyEditVisibleInPreview({
      previewUrl: 'https://preview.example',
      imagePaths: ['/uploads/missing.png'],
      retries: 2,
      delayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result.ok).toBe(false);
    expect(calls).toBe(2);
    expect(result.reason).toContain('none of the uploaded image paths appeared');
  });

  it('succeeds when image path is present in HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          `<html>${'x'.repeat(2000)}<img src="/uploads/hero-abc.png" /></html>`,
      })
    );

    const promise = verifyEditVisibleInPreview({
      previewUrl: 'https://preview.example',
      imagePaths: ['/uploads/hero-abc.png'],
      retries: 1,
      delayMs: 50,
    });
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(result.imagesFound).toBe(1);
  });
});
