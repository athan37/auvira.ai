import { describe, it, expect } from 'vitest';
import { phoneMatchesInHtml, findConflictingPhone } from '@/lib/site-manager/phoneNormalize';

describe('phoneNormalize', () => {
  it('matches expected phone in HTML', () => {
    expect(phoneMatchesInHtml('512-447-2198', '<p>(512) 447-2198</p>')).toBe(true);
  });

  it('finds conflicting phone', () => {
    expect(findConflictingPhone('512-447-2198', 'Call 555-999-0000')).toBe('5559990000');
  });
});
