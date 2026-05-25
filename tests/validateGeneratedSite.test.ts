import { describe, it, expect, afterEach } from 'vitest';
import { shouldRunLocalNpmBuildGate } from '../src/lib/builder/validateGeneratedSite';

describe('shouldRunLocalNpmBuildGate', () => {
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('skips on Vercel serverless by default', () => {
    prev.VERCEL = process.env.VERCEL;
    prev.SITE_AGENT_RUN_BUILD_GATE = process.env.SITE_AGENT_RUN_BUILD_GATE;
    delete process.env.SITE_AGENT_RUN_BUILD_GATE;
    process.env.VERCEL = '1';
    expect(shouldRunLocalNpmBuildGate()).toBe(false);
  });

  it('runs when SITE_AGENT_RUN_BUILD_GATE=1', () => {
    prev.VERCEL = process.env.VERCEL;
    prev.SITE_AGENT_RUN_BUILD_GATE = process.env.SITE_AGENT_RUN_BUILD_GATE;
    process.env.VERCEL = '1';
    process.env.SITE_AGENT_RUN_BUILD_GATE = '1';
    expect(shouldRunLocalNpmBuildGate()).toBe(true);
  });
});
