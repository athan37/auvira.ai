import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { prepareGeneratedWorkspaceForBuild, cleanStaleNextBuildCache } from '@/lib/builder/prepareGeneratedWorkspaceForBuild';
import { generateWebsiteFiles } from '@/lib/builder/generateWebsiteFiles';
import { getDefaultDesignBrief } from '@/lib/agent/generateDesignBriefAgent';
import type { SiteSpec } from '@/lib/agent/schemas';
import { scratchPath } from '@/lib/runtime/scratchDir';

const spec: SiteSpec = {
  siteTitle: 'Repair Test',
  tagline: 'Tag',
  primaryCTA: 'Go',
  designDirection: { tone: 'professional', layout: 'modern', colors: ['#0ea5e9'] },
  secondaryCTA: 'More',
  sections: [{ type: 'hero', title: 'Hi', body: 'Body', items: [] }],
};

describe('prepareGeneratedWorkspaceForBuild', () => {
  let workspacePath = '';

  afterEach(async () => {
    if (workspacePath) {
      await fs.rm(workspacePath, { recursive: true, force: true });
      workspacePath = '';
    }
  });

  it('repairs broken tailwind comma before safelist', async () => {
    const generated = generateWebsiteFiles(spec, 'repair-test', getDefaultDesignBrief('general-service'));
    workspacePath = scratchPath('generated-sites', `repair-test-${Date.now()}`);

    await fs.mkdir(workspacePath, { recursive: true });
    for (const file of generated.files) {
      const abs = path.join(workspacePath, file.filePath);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      let content = file.content;
      if (file.filePath === 'tailwind.config.js') {
        content = content.replace('],\n  safelist:', ']\n  safelist:');
      }
      await fs.writeFile(abs, content, 'utf-8');
    }

    const { repaired } = await prepareGeneratedWorkspaceForBuild(workspacePath);
    expect(repaired).toContain('tailwind.config.js');

    const tailwind = await fs.readFile(path.join(workspacePath, 'tailwind.config.js'), 'utf-8');
    expect(tailwind).toMatch(/\],\s*\n\s*safelist:/);
  });

  it('cleanStaleNextBuildCache removes .next directory', async () => {
    workspacePath = scratchPath('generated-sites', `clean-next-${Date.now()}`);
    await fs.mkdir(path.join(workspacePath, '.next', 'cache'), { recursive: true });
    await fs.writeFile(path.join(workspacePath, '.next', 'BUILD_ID'), 'dev-stale');

    const removed = await cleanStaleNextBuildCache(workspacePath);
    expect(removed).toBe(true);
    await expect(fs.access(path.join(workspacePath, '.next'))).rejects.toThrow();
  });
});
