import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { applySectionBackgroundTool } from '@/lib/project-workspace/tools/domain/applySectionBackground';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { sectionPresentationCardClass } from '@/lib/project-workspace/previewReflectsSiteConfig';

const WORKSPACE = path.join(
  process.cwd(),
  '.tmp/git-workspaces/6a26cc3deeea946b980a52da/repo'
);

describe('contact card favorite color apply pipeline', () => {
  it('apply_section_background updates cardClass from bg-gray-600 to red', async () => {
    let siteConfigBefore: string;
    try {
      siteConfigBefore = readFileSync(path.join(WORKSPACE, 'src/lib/siteConfig.ts'), 'utf8');
    } catch {
      return;
    }

    const built = await buildEditContext({
      workspacePath: WORKSPACE,
      mode: 'gitlab',
      ownerMessage: 'change background to my favorite color',
      infraBaselineReady: true,
      selectedTarget: {
        kind: 'section',
        sectionIndex: 13,
        sectionType: 'contact',
        sectionTitle: 'Contact Us',
        sectionId: 'section_contact_contact-us_14',
        analyticsId: 'section_contact_contact-us_14',
        pinScope: 'section',
        targetChain: [
          { role: 'section', kind: 'contact', label: 'Contact Us' },
          { role: 'container', kind: 'inner_card', label: 'Contact card' },
        ],
      },
    });
    built.context.effectiveMessage =
      'change background to my favorite color [Resolved references: my favorite color=red]';

    const toolResult = await applySectionBackgroundTool(
      {
        editContext: built.context,
        agentOptions: {
          workspacePath: WORKSPACE,
          mode: 'gitlab',
          ownerMessage: built.context.ownerMessage,
          projectId: '6a26cc3deeea946b980a52da',
          infraBaselineReady: true,
        },
        afterFiles: {},
      },
      {
        sectionIndex: 13,
        presentationField: 'cardClass',
        backgroundClass: 'bg-red-600',
        backgroundColor: 'red',
      }
    );

    const after = readFileSync(path.join(WORKSPACE, 'src/lib/siteConfig.ts'), 'utf8');
  const cardClass = sectionPresentationCardClass(after, 13);

    expect(toolResult.ok, JSON.stringify(toolResult, null, 2)).toBe(true);
    expect(cardClass?.toLowerCase(), JSON.stringify(toolResult, null, 2)).toMatch(/red/);
    expect(cardClass).not.toBe('bg-gray-600');

    // restore
    const { writeFileSync } = await import('fs');
    writeFileSync(path.join(WORKSPACE, 'src/lib/siteConfig.ts'), siteConfigBefore, 'utf8');
  });
});
