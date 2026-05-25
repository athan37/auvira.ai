import { describe, it, expect } from 'vitest';
import { runPhoneCheck } from '@/lib/site-manager/checks/phoneCheck';
import { buildFixProposalForIncident } from '@/lib/site-manager/fixProposal.service';
import { patchSiteConfigPhone } from '@/lib/site-manager/siteConfigParser';
import { fixedCopy } from '@/lib/site-manager/notifyCopy';

describe('wrong-phone demo flow', () => {
  const EXPECTED = '512-447-2198';

  it('detects wrong phone', () => {
    const r = runPhoneCheck(
      { liveUrl: 'https://demo.com', html: '<p>555-999-0000</p>', httpStatus: 200 },
      EXPECTED
    );
    expect(r.passed).toBe(false);
  });

  it('proposes restore', () => {
    const p = buildFixProposalForIncident({
      type: 'phone_mismatch',
      expectedValue: EXPECTED,
      observedValue: '5559990000',
    } as Parameters<typeof buildFixProposalForIncident>[0]);
    expect(p?.proposedChange.patchType).toBe('restore_phone');
  });

  it('patches siteConfig', () => {
    const src = `export const siteConfig = { "contact": { "phone": "555-999-0000" }, "sections": [] };`;
    expect(patchSiteConfigPhone(src, EXPECTED)).toContain(EXPECTED);
  });

  it('recheck passes after fix', () => {
    const r = runPhoneCheck(
      { liveUrl: 'https://demo.com', html: '<p>(512) 447-2198</p>', httpStatus: 200 },
      EXPECTED
    );
    expect(r.passed).toBe(true);
  });

  it('fixed copy mentions number', () => {
    const c = fixedCopy('phone_mismatch', EXPECTED);
    expect(c.body).toContain(EXPECTED);
  });
});
