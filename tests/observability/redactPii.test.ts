import { describe, expect, it } from 'vitest';
import {
  buildRedactedSiteConfigSnapshot,
  redactPiiText,
  redactTurnPayload,
} from '@/lib/observability/redactPii';
import type { RecordTurnPayload } from '@/lib/observability/types';

describe('redactPii', () => {
  it('redacts emails and phones in text', () => {
    const input = 'Email me at owner@example.com or call 415-555-0100';
    expect(redactPiiText(input)).toBe(
      'Email me at [REDACTED_EMAIL] or call [REDACTED_PHONE]'
    );
  });

  it('builds minimal site config snapshot', () => {
    const snapshot = buildRedactedSiteConfigSnapshot({
      businessName: 'Acme Co',
      sections: [{ type: 'hero', title: 'Welcome', items: [{}, {}] }],
    });
    expect(snapshot).toMatchObject({
      businessName: 'Acme Co',
      sectionCount: 1,
      sections: [{ index: 0, type: 'hero', title: 'Welcome', itemCount: 2 }],
    });
  });

  it('redacts turn payload before POST', () => {
    const payload: RecordTurnPayload = {
      builder_type: 'la_mue_edit',
      turn_id: 'job1',
      turn_index: 1,
      user_message: 'Update email to team@acme.com',
      reply: 'Updated contact to team@acme.com',
      outcome: 'success',
      latency_ms: 100,
    };
    const redacted = redactTurnPayload(payload);
    expect(redacted.user_message).toContain('[REDACTED_EMAIL]');
    expect(redacted.reply).toContain('[REDACTED_EMAIL]');
  });
});
