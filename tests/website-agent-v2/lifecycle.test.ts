import { describe, expect, it } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import {
  captureEditRunSnapshot,
  repairEditRun,
  rollbackEditRun,
  verifyEditRun,
} from '../../src/lib/project-workspace/website-edit-agent-v2/lifecycle';
import type { EditPlan } from '../../src/lib/project-workspace/website-edit-agent-v2';

async function createWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-v2-life-'));
  await fs.mkdir(path.join(dir, 'src/lib'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'src/lib/siteConfig.ts'),
    `export const siteConfig = {
  businessName: 'Loop Co',
  hero: { headline: 'Welcome' },
  contact: { phone: '555-0100' },
  sections: [],
};`,
    'utf-8'
  );
  return dir;
}

describe('Website Agent V2 lifecycle', () => {
  it('verifies planned values in changed files', async () => {
    const dir = await createWorkspace();
    const options = {
      workspacePath: dir,
      ownerMessage: 'Update phone number to 555-0199',
      projectId: 'test',
      mode: 'gitlab' as const,
    };
    const snapshot = await captureEditRunSnapshot(options);
    await fs.writeFile(
      path.join(dir, 'src/lib/siteConfig.ts'),
      snapshot.files['src/lib/siteConfig.ts'].replace('555-0100', '555-0199'),
      'utf-8'
    );
    const plan: EditPlan = {
      planVersion: 'website-agent-v2',
      intent: 'contact',
      route: 'contact',
      confidence: 'high',
      steps: [{ skill: 'update_contact', args: { field: 'phone', value: '555-0199' } }],
    };

    const result = await verifyEditRun(plan, options, snapshot, ['src/lib/siteConfig.ts']);

    expect(result.ok).toBe(true);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('rolls back files when repair fails', async () => {
    const dir = await createWorkspace();
    const options = {
      workspacePath: dir,
      ownerMessage: 'Update phone number to 555-0199',
      projectId: 'test',
      mode: 'gitlab' as const,
    };
    const snapshot = await captureEditRunSnapshot(options);
    await fs.writeFile(path.join(dir, 'src/lib/siteConfig.ts'), 'export const siteConfig = {', 'utf-8');

    const repair = await repairEditRun(options, ['src/lib/siteConfig.ts']);
    expect(repair.ok).toBe(false);

    const restored = await rollbackEditRun(options, snapshot, ['src/lib/siteConfig.ts']);
    expect(restored).toEqual(['src/lib/siteConfig.ts']);
    const siteConfig = await fs.readFile(path.join(dir, 'src/lib/siteConfig.ts'), 'utf-8');
    expect(siteConfig).toContain('555-0100');

    await fs.rm(dir, { recursive: true, force: true });
  });
});

