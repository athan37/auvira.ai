import { describe, it, expect } from 'vitest';
import { hasExplicitEditTarget } from '@/lib/project-workspace/edit-shared/editTargetUtils';

describe('hasExplicitEditTarget', () => {
  it('detects quoted "to" targets', () => {
    expect(hasExplicitEditTarget('Change headline to "Built for Houston"')).toBe(true);
  });

  it('detects unquoted to targets', () => {
    expect(hasExplicitEditTarget('Update tagline to: Built for Houston')).toBe(true);
  });

  it('detects set/make/update patterns', () => {
    expect(hasExplicitEditTarget('Set the hero title as Welcome Home')).toBe(true);
  });

  it('detects FAQ with numbers', () => {
    expect(hasExplicitEditTarget('Add FAQ item 3 about pricing')).toBe(true);
  });

  it('returns false for vague style requests', () => {
    expect(hasExplicitEditTarget('make the gallery section background red')).toBe(false);
  });
});
