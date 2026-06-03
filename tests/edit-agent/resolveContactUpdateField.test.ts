import { describe, expect, it } from 'vitest';
import {
  resolveContactUpdateField,
  resolveContactUpdateValue,
} from '@/lib/project-workspace/edit-context/resolveContactUpdateField';

describe('resolveContactUpdateField', () => {
  it('prefers explicit field param', () => {
    expect(resolveContactUpdateField({ field: 'email', value: 'a@b.co' })).toBe('email');
  });

  it('uses message keywords over stale email param', () => {
    const merged = { value: 'helllo this is david', email: '1234@asdfasd.edu' };
    expect(
      resolveContactUpdateField(merged, 'change contact information to helllo this is david')
    ).toBe('phone');
  });

  it('uses message email keyword when value is present', () => {
    const merged = { value: 'a@b.co' };
    expect(resolveContactUpdateField(merged, 'change email to a@b.co')).toBe('email');
  });

  it('uses sole param field when value is absent', () => {
    expect(
      resolveContactUpdateField({ email: 'new@example.com' }, 'update contact info')
    ).toBe('email');
  });

  it('resolves value from merged params', () => {
    const merged = { value: 'helllo this is david', email: '1234@asdfasd.edu' };
    const field = resolveContactUpdateField(
      merged,
      'change contact information to helllo this is david'
    );
    expect(resolveContactUpdateValue(merged, field)).toBe('helllo this is david');
  });
});
