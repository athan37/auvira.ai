/**
 * Live LLM regression: siteConfig-only section style + exact preview class verification.
 *
 * Run: RUN_LLM_INTEGRATION_TESTS=true npm run test:llm -- tests/integration/website-edit-agent/sectionStylePreviewSync.integration.test.ts
 */
import '../../llmTestGate';
import { afterEach, expect, it, vi } from 'vitest';
import { runWebsiteEditAgent } from '@/lib/project-workspace/website-edit-agent';
import { SITECONFIG_PRESENTATION_SYNC_EXPORT } from '@/lib/site-manager/siteConfigAgentMarkers';
import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';
import { resolveEditPreviewVerification } from '@/lib/project-workspace/verifyPreviewForPrompt';
import { describeRunLlmIntegration } from '../../llmTestGate';
import {
  cleanupPresentationWorkspace,
  createPresentationTestWorkspace,
  readWorkspacePage,
  readWorkspaceSiteConfig,
} from '../../website-agent-v2/presentationWorkspace';

const PROMPT = 'Change the testimonials section background to red';
const EXPECTED_CLASS = colorNameToBackgroundClass('red');

describeRunLlmIntegration(
  'section style preview sync (LLM integration)',
  () => {
    let workspacePath: string | undefined;

    afterEach(async () => {
      vi.unstubAllGlobals();
      if (workspacePath) {
        await cleanupPresentationWorkspace(workspacePath);
        workspacePath = undefined;
      }
    });

    it('writes siteConfig presentation, sync export, and exact-class preview verify', async () => {
      workspacePath = await createPresentationTestWorkspace();

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: PROMPT,
        projectId: 'llm-section-style-preview-sync',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      const siteConfig = await readWorkspaceSiteConfig(workspacePath);
      const page = await readWorkspacePage(workspacePath);

      if (result.needsClarification) {
        expect(result.ownerMessage?.trim().length).toBeGreaterThan(0);
        return;
      }

      expect(result.ok || result.changedFiles?.length).toBeTruthy();

      if (result.ok) {
        expect(result.changedFiles ?? []).toContain('src/lib/siteConfig.ts');
        expect(siteConfig).toContain(`backgroundClass: "${EXPECTED_CLASS}"`);
        expect(siteConfig).toContain(SITECONFIG_PRESENTATION_SYNC_EXPORT);
      }

      const htmlNoise = [
        '<button class="bg-red-600">x</button>',
        '<p class="text-red-500">red</p>',
        'x'.repeat(2_000),
      ].join('');

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => htmlNoise,
      });
      vi.stubGlobal('fetch', fetchMock);

      const verifyStart = Date.now();
      const verifyFail = await resolveEditPreviewVerification({
        previewUrl: 'http://127.0.0.1:3999',
        ownerMessage: PROMPT,
        attachments: [],
        isSandbox: false,
        mode: 'gitlab',
        siteConfigContent: siteConfig,
        pageContent: page,
      });
      const verifyElapsed = Date.now() - verifyStart;

      expect(verifyFail.ok).toBe(false);
      expect(verifyFail.reason).toContain(EXPECTED_CLASS);
      expect(verifyElapsed).toBeGreaterThan(50);
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: async () => `${htmlNoise}<section class="${EXPECTED_CLASS}">`,
        })
      );

      const verifyPass = await resolveEditPreviewVerification({
        previewUrl: 'http://127.0.0.1:3999',
        ownerMessage: PROMPT,
        attachments: [],
        isSandbox: false,
        mode: 'gitlab',
        siteConfigContent: siteConfig,
        pageContent: page,
      });
      expect(verifyPass.ok).toBe(true);
      expect(verifyPass.reason).toContain(EXPECTED_CLASS);
    });
  }
);
