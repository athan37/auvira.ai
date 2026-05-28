import { describe, it, expect, afterEach, vi } from 'vitest';

vi.mock('@/lib/db/models/CloneJob', () => ({
  CloneJob: { updateOne: vi.fn().mockResolvedValue({}) },
}));

vi.mock('@/lib/agent/generateDesignBriefAgent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/agent/generateDesignBriefAgent')>();
  return {
    ...actual,
    generateDesignBriefAgent: vi.fn(async (_bp, _spec, _url) =>
      actual.getDefaultDesignBrief('home-services')
    ),
  };
});

import { promises as fs } from 'fs';
import path from 'path';
import { ensureClonePreviewWorkspace } from '../src/lib/clone/ensureClonePreviewWorkspace';
import { scratchPath } from '../src/lib/runtime/scratchDir';

describe('ensureClonePreviewWorkspace', () => {
  const jobId = '507f1f77bcf86cd799439011';
  let scratchOverride = '';

  afterEach(async () => {
    delete process.env.SITE_AGENT_SCRATCH_DIR;
    if (scratchOverride) {
      await fs.rm(scratchOverride, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('rehydrates files when workspace directory is missing', async () => {
    scratchOverride = await fs.mkdtemp(path.join(process.cwd(), 'clone-rehydrate-'));
    process.env.SITE_AGENT_SCRATCH_DIR = scratchOverride;

    const workspacePath = scratchPath('generated-sites', jobId);
    const job = {
      _id: { toString: () => jobId },
      sourceUrl: 'https://example.com',
      projectName: 'Test HVAC Co',
      businessProfile: {
        businessName: 'Test HVAC Co',
        industry: 'HVAC',
      },
      suggestedTemplate: { category: 'home-services', variant: 'modern-clean' },
      previewSiteSpec: {
        siteTitle: 'Test HVAC Co',
        tagline: 'Cool air fast',
        primaryCTA: 'Call now',
        secondaryCTA: 'Quote',
        sections: [
          { type: 'hero', title: 'HVAC Experts', body: '24/7 service.', items: ['Fast'] },
          { type: 'services', title: 'Services', body: 'We fix AC.', items: ['Repair'] },
          { type: 'about', title: 'About', body: 'Local team.', items: ['Licensed'] },
          { type: 'contact', title: 'Contact', body: '512-555-0199', items: ['Email us'] },
        ],
        designDirection: { colors: ['#0ea5e9'], style: 'modern' },
      },
      technicalBuild: { workspacePath },
    } as unknown as import('@/lib/db/models/CloneJob').ICloneJob;

    const result = await ensureClonePreviewWorkspace(job);

    expect(result).toBe(workspacePath);
    const pkg = path.join(workspacePath, 'package.json');
    await expect(fs.stat(pkg)).resolves.toBeDefined();
  });
});
