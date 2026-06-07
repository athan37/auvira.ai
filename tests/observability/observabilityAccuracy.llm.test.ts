/**
 * Baseline observability accuracy A/B — simple section background edit.
 *
 * Run: npm run test:observability:accuracy:llm
 */
import { afterEach, it } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../llmTestGate';
import { defaultMultiSectionSiteSpec } from '../support/syntheticSiteWorkspace';
import { assertV3SectionBackgroundEdit } from '../edit-agent/editHarness';
import {
  accuracyScore,
  assertCoachedMeetsOrBeatsControl,
  COACHING_BUILD_GATE,
  destroyAbWorkspaces,
  runObservabilityAb,
} from './observabilityAccuracyHarness';

describeRunLlmIntegration('observability accuracy A/B (baseline)', () => {
  let controlPath: string | undefined;
  let coachedPath: string | undefined;

  afterEach(async () => {
    await destroyAbWorkspaces(controlPath, coachedPath);
    controlPath = undefined;
    coachedPath = undefined;
  });

  it(
    'coached run matches control on straightforward gallery yellow background',
    async () => {
      const siteSpec = defaultMultiSectionSiteSpec();
      const galleryIndex = siteSpec.sections.findIndex((section) => section.type === 'gallery');
      const galleryTitle = siteSpec.sections[galleryIndex].title!;
      const ownerMessage = `Change the "${galleryTitle}" section background to yellow`;

      const ab = await runObservabilityAb({
        siteSpec,
        ownerMessage,
        coaching: COACHING_BUILD_GATE,
        controlProjectId: 'llm-obs-accuracy-control',
        coachedProjectId: 'llm-obs-accuracy-coached',
      });
      controlPath = ab.controlWorkspacePath;
      coachedPath = ab.coachedWorkspacePath;

      const validateTarget = async (workspacePath: string) => {
        try {
          await assertV3SectionBackgroundEdit(workspacePath, {
            targetIndex: galleryIndex,
            targetType: 'gallery',
            targetTitle: galleryTitle,
            ownerMessage,
            color: 'yellow',
          });
          return true;
        } catch {
          return false;
        }
      };

      const controlValid = await validateTarget(controlPath);
      const coachedValid = await validateTarget(coachedPath);
      const controlScore = accuracyScore(ab.control, controlValid);
      const coachedScore = accuracyScore(ab.coached, coachedValid);

      assertCoachedMeetsOrBeatsControl({
        label: 'baseline-gallery-yellow',
        control: ab.control,
        coached: ab.coached,
        controlScore,
        coachedScore,
      });
    },
    LLM_TEST_TIMEOUT_MS
  );
});
