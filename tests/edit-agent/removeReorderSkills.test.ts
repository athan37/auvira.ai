import { afterEach, describe, expect, it } from 'vitest';
import {
  executeDomainTool,
  paramsForSkill,
  skillToDomainTool,
} from '@/lib/project-workspace/tools/domain/registry';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';

describe('remove_section and reorder_sections skills', () => {
  let workspacePath: string;

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = '';
    }
  });

  it('maps skills to dedicated domain tools (not update_section_list)', () => {
    expect(skillToDomainTool('remove_section')).toBe('remove_section');
    expect(skillToDomainTool('reorder_sections')).toBe('reorder_sections');
  });

  it('paramsForSkill passes sectionIndex for remove_section', () => {
    const params = paramsForSkill('remove_section', { sectionIndex: 1 }, {}, {
      target: { sectionIndex: 0 },
      effectiveMessage: 'remove section 2',
    } as never);
    expect(params.sectionIndex).toBe(1);
  });

  it('removes a section by index in siteConfig', async () => {
    workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Services' },
          { type: 'contact', title: 'Contact' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const ctxResult = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: 'Remove the contact section',
      infraBaselineReady: true,
    });

    const result = await executeDomainTool(
      'remove_section',
      {
        editContext: ctxResult.context,
        agentOptions: {
          workspacePath,
          ownerMessage: 'Remove the contact section',
          projectId: 'test',
          mode: 'gitlab',
          infraBaselineReady: true,
        },
        changedFiles: [],
        beforeFiles: {},
        afterFiles: {},
      },
      { sectionIndex: 1 }
    );

    expect(result.ok).toBe(true);
    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfig).toContain('Services');
    expect(siteConfig).not.toMatch(/"title":\s*"Contact"/);
  });

  it('reorders sections in siteConfig', async () => {
    workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          { type: 'services', title: 'Services' },
          { type: 'contact', title: 'Contact' },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const ctxResult = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: 'Move contact above services',
      infraBaselineReady: true,
    });

    const result = await executeDomainTool(
      'reorder_sections',
      {
        editContext: ctxResult.context,
        agentOptions: {
          workspacePath,
          ownerMessage: 'Move contact above services',
          projectId: 'test',
          mode: 'gitlab',
          infraBaselineReady: true,
        },
        changedFiles: [],
        beforeFiles: {},
        afterFiles: {},
      },
      { order: [1, 0] }
    );

    expect(result.ok).toBe(true);
    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const contactIdx = siteConfig.indexOf('"Contact"');
    const servicesIdx = siteConfig.indexOf('"Services"');
    expect(contactIdx).toBeGreaterThan(-1);
    expect(servicesIdx).toBeGreaterThan(-1);
    expect(contactIdx).toBeLessThan(servicesIdx);
  });
});
