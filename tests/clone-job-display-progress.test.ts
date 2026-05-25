import { describe, it, expect } from 'vitest';
import { getCloneJobDisplayProgress } from '@/lib/clone/cloneJobDisplayProgress';

describe('getCloneJobDisplayProgress', () => {
  it('caps review_ready below 100 even when stored percent is 100', () => {
    expect(getCloneJobDisplayProgress('review_ready', 100)).toBe(50);
  });

  it('returns 100 only when completed', () => {
    expect(getCloneJobDisplayProgress('completed', 75)).toBe(100);
  });

  it('treats legacy ready status as 100%', () => {
    expect(getCloneJobDisplayProgress('ready', 97)).toBe(100);
  });
});
