import { describe, it, expect } from 'vitest';
import { runPhoneCheck } from '@/lib/site-manager/checks/phoneCheck';
import { runUptimeCheck } from '@/lib/site-manager/checks/uptimeCheck';

describe('checks', () => {
  it('phone fails on wrong number', () => {
    const r = runPhoneCheck(
      { liveUrl: 'https://x.com', html: '<p>555-999-0000</p>', httpStatus: 200 },
      '512-447-2198'
    );
    expect(r.passed).toBe(false);
  });

  it('uptime fails on 404', () => {
    const r = runUptimeCheck({ liveUrl: 'https://x.com', html: '', httpStatus: 404 }, 'live');
    expect(r.passed).toBe(false);
  });
});
