import { describe, it, expect, afterEach } from 'vitest';
import { isSandboxPreviewEnabled } from '@/lib/runtime/isSandboxPreviewEnabled';

describe('isSandboxPreviewEnabled', () => {
  const prevVercel = process.env.VERCEL;
  const prevFlag = process.env.SITE_AGENT_SANDBOX_ENABLED;

  afterEach(() => {
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevFlag === undefined) delete process.env.SITE_AGENT_SANDBOX_ENABLED;
    else process.env.SITE_AGENT_SANDBOX_ENABLED = prevFlag;
  });

  it('is false when not on Vercel serverless', () => {
    delete process.env.VERCEL;
    expect(isSandboxPreviewEnabled()).toBe(false);
  });

  it('is true on Vercel by default', () => {
    process.env.VERCEL = '1';
    delete process.env.SITE_AGENT_SANDBOX_ENABLED;
    expect(isSandboxPreviewEnabled()).toBe(true);
  });

  it('is false when explicitly disabled', () => {
    process.env.VERCEL = '1';
    process.env.SITE_AGENT_SANDBOX_ENABLED = '0';
    expect(isSandboxPreviewEnabled()).toBe(false);
  });
});
