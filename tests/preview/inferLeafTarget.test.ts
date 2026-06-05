import { describe, expect, it } from 'vitest';
import { buildSectionBridgeScriptBody } from '@/lib/preview/sectionBridgeScript';

describe('inferLeafTarget bridge integration', () => {
  it('includes leaf inference fallback in readPayload', () => {
    const body = buildSectionBridgeScriptBody();
    expect(body).toContain('function inferLeafTarget');
    expect(body).toContain('inferLeafTarget(el,target,idx)');
    expect(body).toContain('inferLeafTarget(el,target,-1)');
  });

  it('falls back when element chain has no fieldPath', () => {
    const body = buildSectionBridgeScriptBody();
    expect(body).toContain('n.role==="element"&&n.fieldPath');
  });
});
