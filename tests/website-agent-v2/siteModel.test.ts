import { describe, expect, it } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { buildSiteModel } from '../../src/lib/project-workspace/website-edit-agent-v2';

describe('Website Agent V2 SiteModel', () => {
  it('builds a compact model from siteConfig and known page files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-v2-model-'));
    await fs.mkdir(path.join(dir, 'src/app'), { recursive: true });
    await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'src/lib/siteConfig.ts'),
      `export const siteConfig = {
  businessName: 'Loop Co',
  hero: { headline: 'Welcome', subheadline: 'We help owners' },
  contact: { phone: '555-0100', email: 'hello@example.com' },
  sections: [
    { type: 'services', title: 'Services', items: [{ title: 'Consulting', description: 'Planning help' }] },
    { type: 'about', title: 'About', body: 'Local team' },
  ],
};`,
      'utf-8'
    );
    await fs.writeFile(path.join(dir, 'src/app/page.tsx'), 'export default function Home() { return null; }', 'utf-8');
    await fs.writeFile(path.join(dir, 'src/app/globals.css'), 'body { margin: 0; }', 'utf-8');

    const model = await buildSiteModel({
      workspacePath: dir,
      ownerMessage: 'change phone number',
      projectId: 'test',
      mode: 'gitlab',
    });

    expect(model.businessName).toBe('Loop Co');
    expect(model.hero.headline).toBe('Welcome');
    expect(model.contact.phone).toBe('555-0100');
    expect(model.sections).toHaveLength(2);
    expect(model.sections[0]).toMatchObject({
      index: 0,
      type: 'services',
      title: 'Services',
      itemCount: 1,
    });
    expect(model.capabilities.supportsConfigSkills).toBe(true);
    expect(model.files.map((file) => file.path)).toEqual([
      'src/lib/siteConfig.ts',
      'src/app/page.tsx',
      'src/app/globals.css',
    ]);

    await fs.rm(dir, { recursive: true, force: true });
  });
});

