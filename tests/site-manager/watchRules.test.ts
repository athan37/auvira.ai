import { describe, it, expect } from 'vitest';
import { buildMonitorSuggestions } from '@/lib/site-manager/watchRules.service';
import { buildFixProposalForIncident } from '@/lib/site-manager/fixProposal.service';
import type { ISiteHealthIncident } from '@/models/SiteHealthIncident';

describe('watchRules.service', () => {
  it('suggests monitors from profile', () => {
    const suggestions = buildMonitorSuggestions({
      phone: '512-447-2198',
      hours: 'Mon-Sat 8-6',
      mainServices: ['Brake service'],
      bannerRules: [],
    });

    const types = suggestions.map((s) => s.type);
    expect(types).toContain('uptime');
    expect(types).toContain('phone');
    expect(types).toContain('hours');
    expect(types).toContain('service_visibility');
  });
});

describe('fixProposal.service', () => {
  it('builds phone restore proposal', () => {
    const incident = {
      type: 'phone_mismatch',
      expectedValue: '512-447-2198',
      observedValue: '5550000000',
    } as ISiteHealthIncident;

    const built = buildFixProposalForIncident(incident);
    expect(built?.proposedChange.patchType).toBe('restore_phone');
    expect(built?.plainEnglishSummary).toContain('512-447-2198');
  });
});
