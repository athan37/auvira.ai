import { describe, expect, it } from 'vitest';
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

describe('action items domain tools', () => {
  it('add_action_item writes actionItems in siteConfig', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          {
            type: 'actions',
            title: 'Packages',
            moduleKind: 'service_packages',
            actionItems: [],
          },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const ctxResult = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: 'Add a service package',
      infraBaselineReady: true,
    });

    const result = await executeDomainTool('update_action_items', minimalToolCtx(ctxResult.context), {
      action: 'add_action_item',
      name: 'Premium Tune-Up',
      actionType: 'quote',
      moduleKind: 'service_packages',
      valueLabel: 'From $199',
    });

    expect(result.ok).toBe(true);
    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfig).toContain('Premium Tune-Up');
    expect(siteConfig).toContain('From $199');
    expect(siteConfig).toContain('"actionType": "quote"');
  });

  it('update_action_item changes valueLabel and ctaLabel', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: {
        sections: [
          {
            type: 'actions',
            title: 'Support Us',
            moduleKind: 'donation_tiers',
            actionItems: [
              {
                id: 'tier-1',
                name: 'Friend',
                valueLabel: '$25',
                ctaLabel: 'Donate Now',
                actionType: 'donate',
              },
            ],
          },
        ],
      },
      pageMode: 'wired',
      tailwind: 'canonical',
    });

    const ctxResult = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: 'Change price',
      infraBaselineReady: true,
      selectedTarget: {
        sectionIndex: 0,
        sectionType: 'actions',
        kind: 'action_value',
        fieldPath: 'sections[0].actionItems[0].valueLabel',
      },
    });

    const toolCtx = minimalToolCtx(ctxResult.context);
    const valueResult = await executeDomainTool('update_action_items', toolCtx, {
      action: 'update_action_item',
      sectionIndex: 0,
      itemIndex: 0,
      valueLabel: 'From $149',
    });
    expect(valueResult.ok).toBe(true);

    const ctaResult = await executeDomainTool('update_action_items', toolCtx, {
      action: 'update_action_item',
      sectionIndex: 0,
      itemIndex: 0,
      ctaLabel: 'Request Quote',
    });
    expect(ctaResult.ok).toBe(true);

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(siteConfig).toContain('From $149');
    expect(siteConfig).toContain('Request Quote');
  });
});
