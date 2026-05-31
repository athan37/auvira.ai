import { describe, it, expect } from 'vitest';
import path from 'path';
import { readFileSync } from 'fs';
import {
  detectPageArchetype,
  resolveSiteWorkspace,
} from '../../src/lib/project-workspace/edit-shared/resolveSiteWorkspace';

const FIXTURES = path.join(process.cwd(), 'tests/fixtures/workspaces');

describe('resolveSiteWorkspace', () => {
  it('detects section_loop archetype', async () => {
    const root = path.join(FIXTURES, 'section-loop-default');
    const snap = await resolveSiteWorkspace({ workspacePath: root, mode: 'gitlab' });
    expect(snap.archetype).toBe('section_loop');
    expect(snap.siteConfigPath).toBe('src/lib/siteConfig.ts');
    expect(snap.pagePath).toBe('src/app/page.tsx');
  });

  it('detects default-null as section_loop with null default', async () => {
    const root = path.join(FIXTURES, 'default-null');
    const snap = await resolveSiteWorkspace({ workspacePath: root, mode: 'gitlab' });
    expect(snap.archetype).toBe('section_loop');
    expect(snap.pageContent).toMatch(/default:\s*\n?\s*return\s+null/);
  });

  it('detects hardcoded archetype', () => {
    const page = readFileSync(
      path.join(FIXTURES, 'hardcoded-no-loop/src/app/page.tsx'),
      'utf8'
    );
    expect(detectPageArchetype(page, null)).toBe('hardcoded');
  });
});
