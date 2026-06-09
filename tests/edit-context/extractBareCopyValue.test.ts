import { describe, expect, it } from 'vitest';
import { extractBareCopyValue } from '@/lib/project-workspace/edit-context/configTextEditUtils';

describe('extractBareCopyValue', () => {
  it('accepts plain pinned paste', () => {
    expect(extractBareCopyValue("We'd love to hear from you", true)).toBe(
      "We'd love to hear from you"
    );
  });

  it('rejects without pin', () => {
    expect(extractBareCopyValue("We'd love to hear from you", false)).toBeNull();
  });

  it('rejects structural card commands', () => {
    expect(extractBareCopyValue('duplicate this card', true)).toBeNull();
    expect(extractBareCopyValue('delete this card', true)).toBeNull();
  });
});
