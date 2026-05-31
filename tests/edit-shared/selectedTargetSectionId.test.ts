import { describe, expect, it } from 'vitest';
import { selectedTargetSectionId } from '@/lib/project-workspace/edit-shared/selectedTargetTypes';

describe('selectedTargetSectionId', () => {
  it('returns hero id for hero targets', () => {
    expect(selectedTargetSectionId({ kind: 'hero', sectionType: 'hero' })).toBe('hero');
  });

  it('prefers sectionId for section targets', () => {
    expect(
      selectedTargetSectionId({
        kind: 'section',
        sectionId: 'section_contact_contact_1',
        analyticsId: 'analytics_contact',
        sectionType: 'contact',
      })
    ).toBe('section_contact_contact_1');
  });
});
