import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import {
  captureEditRunSnapshot,
  rollbackEditRun,
} from '@/lib/project-workspace/editRunSnapshot';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
} from '../support/syntheticSiteWorkspace';

describe('editRunSnapshot', () => {
  let workspacePath: string;

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = '';
    }
  });

  it('includes tailwind.config.js for section color rollback', async () => {
    workspacePath = await createSyntheticWorkspace({
      site: { sections: [{ type: 'services', title: 'Services' }] },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const tailwindPath = path.join(workspacePath, 'tailwind.config.js');
    const original = await fs.readFile(tailwindPath, 'utf-8');
    await fs.writeFile(tailwindPath, `${original}\n// agent-test-marker\n`, 'utf-8');

    const snapshot = await captureEditRunSnapshot({
      workspacePath,
      ownerMessage: 'test',
      projectId: 'snap-test',
      mode: 'gitlab',
    });

    expect(snapshot.files['tailwind.config.js']).toContain('module.exports');

    await fs.writeFile(tailwindPath, 'corrupted', 'utf-8');
    const restored = await rollbackEditRun(
      {
        workspacePath,
        ownerMessage: 'test',
        projectId: 'snap-test',
        mode: 'gitlab',
      },
      snapshot,
      ['tailwind.config.js']
    );

    expect(restored).toContain('tailwind.config.js');
    const after = await fs.readFile(tailwindPath, 'utf-8');
    expect(after).toBe(snapshot.files['tailwind.config.js']);
    expect(after).not.toBe('corrupted');
  });
});
