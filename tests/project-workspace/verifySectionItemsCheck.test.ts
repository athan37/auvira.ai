import { describe, expect, it } from 'vitest';
import { addSectionItemToSource, removeSectionItemFromSource } from '@/lib/project-workspace/siteConfigMutations';
import { verifySectionItemsCheck } from '@/lib/project-workspace/tools/domain/verifySourceInvariants';
import type { VerificationCheck } from '@/lib/project-workspace/edit-context/types';

const BEFORE = `export const siteConfig = {
  sections: [
    {
      type: 'generic',
      title: 'Stay Connected',
      items: [
        { title: 'Card one', description: 'First' },
        { title: 'Card two', description: 'Second' },
      ],
    },
    {
      type: 'services',
      title: 'Services',
      items: [{ title: 'Existing service' }],
    },
  ],
};`;

describe('verifySectionItemsCheck', () => {
  it('passes when add increases only the target section item count', () => {
    const after = addSectionItemToSource(
      BEFORE,
      0,
      { title: 'hello', description: 'Second' },
      { insertAfterIndex: 1 }
    )!;
    const check: VerificationCheck = {
      kind: 'section_items',
      sectionIndex: 0,
      operation: 'add',
      expectedLengthDelta: 1,
      expectedInsertIndex: 2,
      field: 'title',
      expectedValue: 'hello',
    };
    expect(verifySectionItemsCheck(BEFORE, after, check)).toEqual([]);
  });

  it('fails when an unrelated section items array changes', () => {
    const after = removeSectionItemFromSource(BEFORE, 0, 1)!.replace(
      '"Existing service"',
      '"Changed service"'
    );
    const check: VerificationCheck = {
      kind: 'section_items',
      sectionIndex: 0,
      operation: 'remove',
      itemIndex: 1,
      expectedLengthDelta: -1,
    };
    expect(
      verifySectionItemsCheck(BEFORE, after, check).some((e) =>
        e.includes('section 1 items changed unexpectedly')
      )
    ).toBe(true);
  });
});
