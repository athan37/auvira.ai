import { describe, it, expect } from 'vitest';
import { parseSiteConfigSource, patchSiteConfigPhone } from '@/lib/site-manager/siteConfigParser';

describe('siteConfigParser', () => {
  it('patches phone in minimal siteConfig', () => {
    const src = `export const siteConfig = { "contact": { "phone": "555-999-0000" }, "sections": [] };`;
    const patched = patchSiteConfigPhone(src, '512-447-2198');
    expect(patched).toContain('512-447-2198');
    expect(parseSiteConfigSource(patched)?.contact?.phone).toBe('512-447-2198');
  });
});
