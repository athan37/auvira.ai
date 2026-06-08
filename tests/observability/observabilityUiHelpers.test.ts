import { describe, expect, it } from 'vitest';
import { gradeToBadgeTone, outcomeToBadgeTone } from '@/lib/observability/observabilityUiHelpers';

describe('observabilityUiHelpers', () => {
  it('maps outcomes to semantic badge tones', () => {
    expect(outcomeToBadgeTone('success')).toBe('success');
    expect(outcomeToBadgeTone('clarification')).toBe('warning');
    expect(outcomeToBadgeTone('failure')).toBe('error');
    expect(outcomeToBadgeTone(undefined)).toBe('default');
  });

  it('maps letter grades to semantic badge tones', () => {
    expect(gradeToBadgeTone('A')).toBe('success');
    expect(gradeToBadgeTone('B')).toBe('info');
    expect(gradeToBadgeTone('C')).toBe('warning');
    expect(gradeToBadgeTone('D')).toBe('error');
    expect(gradeToBadgeTone('F')).toBe('error');
    expect(gradeToBadgeTone(undefined)).toBe('default');
  });
});
