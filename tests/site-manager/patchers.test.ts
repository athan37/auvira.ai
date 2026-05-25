import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { applyRestorePhone } from '@/lib/site-manager/patchers/restorePhone';
import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';

const SITE_CONFIG = `export type SiteConfig = {
  businessName: string;
  contact: { phone?: string };
  sections: [];
};
export const siteConfig: SiteConfig = {
  "businessName": "Test",
  "contact": { "phone": "555-000-0000" },
  "sections": []
};`;

describe('restorePhone patcher', () => {
  it('updates workspace siteConfig phone', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sm-patch-'));
    const libDir = path.join(dir, 'src/lib');
    await fs.mkdir(libDir, { recursive: true });
    await fs.writeFile(path.join(libDir, 'siteConfig.ts'), SITE_CONFIG);

    const changed = await applyRestorePhone(dir, { phone: '512-447-2198' });
    expect(changed).toContain('src/lib/siteConfig.ts');

    const content = await fs.readFile(path.join(libDir, 'siteConfig.ts'), 'utf-8');
    const parsed = parseSiteConfigSource(content);
    expect(parsed?.contact?.phone).toBe('512-447-2198');

    await fs.rm(dir, { recursive: true, force: true });
  });
});
