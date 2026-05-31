import { describe, expect, it } from 'vitest';
import { resolveDuplicateCopyTarget } from '@/lib/project-workspace/edit-context/resolveDuplicateCopyTarget';

const DUPLICATE_SITE_CONFIG = `export const siteConfig = {
  businessName: 'Same Title Co',
  hero: { headline: 'Same Title Co', subheadline: 'We do things' },
  contact: {},
  sections: [
    { type: 'services', title: 'Our Products', body: '', items: [] },
  ],
};`;

describe('resolveDuplicateCopyTarget', () => {
  it('skips duplicate clarification for section title copy edits', () => {
    const message = 'change Our Products section title to hello this is david 2';
    expect(resolveDuplicateCopyTarget(DUPLICATE_SITE_CONFIG, message)).toBeNull();
  });

  it('still clarifies for short ambiguous messages without section scope', () => {
    const result = resolveDuplicateCopyTarget(DUPLICATE_SITE_CONFIG, 'Same Title Co');
    expect(result?.needsClarification).toBe(true);
    expect(result?.clarificationMessage).toMatch(/business name and hero headline/i);
  });

  it('allows new value after user chose both business name and hero', () => {
    const result = resolveDuplicateCopyTarget(DUPLICATE_SITE_CONFIG, 'All-Star HVAC', [
      { role: 'assistant', content: 'Which should I update?' },
      { role: 'user', content: 'Both the business name and hero headline' },
      { role: 'assistant', content: 'What new text should I use for both?' },
    ]);
    expect(result?.needsClarification).toBe(false);
  });

  it('asks for new value when user picks both without providing text', () => {
    const result = resolveDuplicateCopyTarget(
      DUPLICATE_SITE_CONFIG,
      'Both the business name and hero headline',
      [{ role: 'assistant', content: 'Which should I update?' }]
    );
    expect(result?.needsClarification).toBe(true);
    expect(result?.clarificationMessage).toMatch(/new text/i);
  });
});
