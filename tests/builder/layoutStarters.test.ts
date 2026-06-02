import { describe, expect, it } from 'vitest';
import {
  getDefaultLayoutStarter,
  getLayoutStarter,
  getLayoutStarters,
} from '@/lib/builder/layoutStarters';

describe('layoutStarters', () => {
  it('returns five layout starters', () => {
    expect(getLayoutStarters()).toHaveLength(5);
  });

  it('resolves known starter ids', () => {
    const starter = getLayoutStarter('phone-first-service');
    expect(starter?.heroStyle).toBe('phone-first');
    expect(starter?.variant).toBe('local-service-pro');
  });

  it('falls back to default starter', () => {
    expect(getDefaultLayoutStarter().id).toBe('centered-minimal');
    expect(getLayoutStarter('unknown-id')).toBeUndefined();
  });
});
