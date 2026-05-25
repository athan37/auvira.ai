import { describe, it, expect } from 'vitest';
import { parseSandboxTimeout } from '@/lib/sandbox/sandboxClient';

describe('parseSandboxTimeout', () => {
  it('parses minute suffix', () => {
    expect(parseSandboxTimeout('30m')).toBe(30 * 60 * 1000);
  });

  it('parses hour suffix', () => {
    expect(parseSandboxTimeout('1h')).toBe(60 * 60 * 1000);
  });

  it('defaults to 30 minutes for invalid input', () => {
    expect(parseSandboxTimeout('nope')).toBe(30 * 60 * 1000);
  });
});
