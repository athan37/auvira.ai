import { describe, expect, it } from 'vitest';
import {
  isBackgroundColorEditRequest,
  isSectionScopedSolidColorRequest,
  isTextColorEditRequest,
} from '@/lib/project-workspace/verifyPreviewHints';

describe('verifyPreviewHints section-scoped color', () => {
  it('detects first section solid color without background keyword', () => {
    expect(isSectionScopedSolidColorRequest('change first section to red')).toBe(true);
    expect(isBackgroundColorEditRequest('change first section to red')).toBe(true);
  });

  it('detects generic section + change + to + color', () => {
    expect(isSectionScopedSolidColorRequest('change section to blue')).toBe(true);
  });

  it('excludes text color requests', () => {
    expect(isTextColorEditRequest('change first section title to red')).toBe(true);
    expect(isSectionScopedSolidColorRequest('change first section title to red')).toBe(false);
  });

  it('still requires explicit background keywords for non-section prompts', () => {
    expect(isBackgroundColorEditRequest('make the header red')).toBe(false);
    expect(isBackgroundColorEditRequest('change the background to red')).toBe(true);
  });
});
