import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { getScratchRoot } from '../src/lib/runtime/scratchDir';

describe('scratchDir', () => {
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('uses /tmp on Vercel', () => {
    prev.VERCEL = process.env.VERCEL;
    process.env.VERCEL = '1';
    const root = getScratchRoot();
    expect(root.endsWith(path.join('site-agent'))).toBe(true);
    expect(root).not.toContain('/var/task');
  });
});
