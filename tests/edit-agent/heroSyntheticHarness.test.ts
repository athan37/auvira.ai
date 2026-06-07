import { describe, expect, it } from 'vitest';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../support/syntheticSiteWorkspace';
import { heroClarificationReplaySiteSpec } from '../support/heroClarificationReplaySiteSpec';
import { extractPresetObjectLiteral } from '@/lib/project-workspace/edit-shared/preset/presetUtils';
import { runPresetThemeStrategy } from '@/lib/project-workspace/edit-shared/strategies/presetThemeStrategy';
import { computeWorkspaceHashes } from '@/lib/project-workspace/workspaceEditShared';

describe('synthetic workspace hero harness', () => {
  it('includes heroBg preset and preset_theme strategy applies gradient', async () => {
    const workspacePath = await createSyntheticWorkspace({
      site: heroClarificationReplaySiteSpec(),
      pageMode: 'wired',
      tailwind: 'canonical',
    });
    try {
      const page = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
      const preset = extractPresetObjectLiteral(page);
      expect(preset?.includes('heroBg')).toBe(true);

      const hashes = await computeWorkspaceHashes(workspacePath);
      const result = await runPresetThemeStrategy(
        {
          workspacePath,
          ownerMessage: 'hero background Blue to green gradient',
          mode: 'gitlab',
          projectId: 'harness',
          infraBaselineReady: true,
        },
        hashes
      );
      expect(result?.ok, JSON.stringify(result)).toBe(true);

      const pageAfter = await readSyntheticFile(workspacePath, 'src/app/page.tsx');
      expect(pageAfter).toMatch(/heroBg.*linear-gradient/i);
    } finally {
      await destroySyntheticWorkspace(workspacePath);
    }
  });
});
