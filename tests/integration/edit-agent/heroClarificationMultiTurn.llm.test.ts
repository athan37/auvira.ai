/**
 * Live LLM E2E: 6a1f8d-style hero clarification multi-turn.
 *
 * Run: npm run test:llm -- tests/integration/edit-agent/heroClarificationMultiTurn.llm.test.ts
 */
import { afterEach, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../../llmTestGate';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../../support/syntheticSiteWorkspace';
import {
  heroClarificationHistoryThroughTurn2,
  heroClarificationReplaySiteSpec,
  HERO_CLARIFICATION_TURN3,
} from '../../support/heroClarificationReplaySiteSpec';
import { parseSections, sectionBackgroundClass } from '../../edit-agent/editHarness';
import { mustSucceed } from '../../support/llmEditScenario';

describeRunLlmIntegration('hero clarification multi-turn E2E (LLM)', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it(
    'turn 4: Blue to green gradient after hero clarifications updates hero only',
    async () => {
      workspacePath = await createSyntheticWorkspace({
        site: heroClarificationReplaySiteSpec(),
        pageMode: 'wired',
        tailwind: 'canonical',
      });

      const pageBefore = await fs.readFile(path.join(workspacePath, 'src/app/page.tsx'), 'utf-8');
      const siteConfigBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const aboutIndex = 1;
      const aboutBgBefore = sectionBackgroundClass(parseSections(siteConfigBefore)[aboutIndex] ?? {}) ?? '';

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: HERO_CLARIFICATION_TURN3,
        conversationHistory: heroClarificationHistoryThroughTurn2(),
        projectId: 'hero-clarification-multiturn-llm',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      mustSucceed(result, result.error ?? result.ownerMessage ?? 'hero clarification E2E failed');

      const pageAfter = await fs.readFile(path.join(workspacePath, 'src/app/page.tsx'), 'utf-8');
      const siteConfigAfter = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const aboutBgAfter = sectionBackgroundClass(parseSections(siteConfigAfter)[aboutIndex] ?? {}) ?? '';

      expect(pageAfter).not.toBe(pageBefore);
      expect(pageAfter).toMatch(/heroBg/i);
      expect(aboutBgAfter).toBe(aboutBgBefore);

      const summary = `${result.summary ?? ''} ${result.ownerMessage ?? ''}`.toLowerCase();
      expect(summary).not.toMatch(/\babout us\b.*background/);
    },
    LLM_TEST_TIMEOUT_MS
  );
});
