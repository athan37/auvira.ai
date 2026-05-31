import { describe, it, expect } from 'vitest';
import { executeDomainTool } from '@/lib/project-workspace/tools/domain/registry';
import type { DomainToolContext } from '@/lib/project-workspace/tools/domain/types';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import {
  createSyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';

function minimalToolCtx(
  editContext: Awaited<ReturnType<typeof buildEditContext>>['context']
): DomainToolContext {
  return {
    editContext,
    agentOptions: {
      workspacePath: editContext.workspacePath,
      ownerMessage: editContext.ownerMessage,
      projectId: 'test',
      mode: 'gitlab',
      infraBaselineReady: true,
    },
    changedFiles: [],
    beforeFiles: {},
    afterFiles: {},
  };
}

describe('domain tools', () => {
  it('update_contact_info writes phone to siteConfig', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: { sections: [{ type: 'contact', title: 'Contact' }] },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const ctxResult = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: 'Change phone to (713) 555-0199',
      infraBaselineReady: true,
    });

    const toolCtx = minimalToolCtx(ctxResult.context);
    const result = await executeDomainTool('update_contact_info', toolCtx, {
      field: 'phone',
      value: '(713) 555-0199',
    });

    expect(result.ok).toBe(true);
    expect(result.changedFiles).toContain('src/lib/siteConfig.ts');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfig).toContain('(713) 555-0199');
  });

  it('apply_section_background sets presentation.backgroundClass', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Everything You Need to Grow Your Business' },
          { type: 'contact', title: 'Get Started Today' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const ownerMessage =
      'change this section background to color gradient "Everything You Need to Grow Your Business"';

    const ctxResult = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage,
      infraBaselineReady: true,
    });

    const toolCtx = minimalToolCtx(ctxResult.context);
    const result = await executeDomainTool('apply_section_background', toolCtx, {
      sectionIndex: 0,
      sectionType: 'services',
      title: 'Everything You Need to Grow Your Business',
    });

    expect(result.ok).toBe(true);
    expect(result.evidence?.backgroundClass).toMatch(/gradient/);

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfig).toContain('backgroundClass');
    expect(siteConfig).toContain('gradient');
  });
});
