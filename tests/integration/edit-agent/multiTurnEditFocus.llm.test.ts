/**
 * LLM integration: N-turn edit focus chains (image → caption → style on "that section").
 *
 * Run: npm run test:llm -- tests/integration/edit-agent/multiTurnEditFocus.llm.test.ts
 */
import '../../llmTestGate';
import { afterEach, describe, expect, it } from 'vitest';
import { describeRunLlmIntegration, LLM_TEST_TIMEOUT_MS } from '../../llmTestGate';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { runWebsiteEdit } from '@/lib/project-workspace/websiteEditRunner';
import {
  buildEditFocusStackAfterEdit,
  editFocusFromLastGalleryEdit,
} from '@/lib/project-workspace/edit-shared/editFocus';
import {
  conversationAfterCaptionTurn,
  focusAfterCaptionTurn,
  MULTI_TURN_CAPTION_USER,
  MULTI_TURN_GRADIENT_USER,
  MULTI_TURN_IMAGE_USER,
  seedSingleImageGallerySection,
} from '../../support/multiTurnEditFocusScenario';
import {
  writeSyntheticUploadFiles,
} from '../../support/galleryDescriptionScenario';
import { mustSucceed } from '../../support/llmEditScenario';
import {
  createSyntheticWorkspace,
  destroySyntheticWorkspace,
  readSyntheticFile,
} from '../../support/syntheticSiteWorkspace';
import { parseSections, sectionBackgroundClass } from '../../edit-agent/editHarness';

describeRunLlmIntegration('multi-turn edit focus (LLM)', () => {
  let workspacePath: string | undefined;

  afterEach(async () => {
    if (workspacePath) {
      await destroySyntheticWorkspace(workspacePath);
      workspacePath = undefined;
    }
  });

  it(
    '4-turn: image → caption → blue-green gradient on that section',
    async () => {
      workspacePath = await createSyntheticWorkspace({
        site: {
          sections: [
            { type: 'services', title: 'Services' },
            { type: 'gallery', title: 'New Gallery' },
            { type: 'about', title: 'About' },
          ],
        },
        pageMode: 'wired',
        tailwind: 'canonical',
      });
      await seedSingleImageGallerySection(workspacePath, 1);

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: MULTI_TURN_GRADIENT_USER,
        conversationHistory: conversationAfterCaptionTurn(),
        editFocusStack: focusAfterCaptionTurn(1),
        projectId: 'llm-multi-turn-gradient',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.ownerMessage).toBe(true);

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const sections = parseSections(siteConfig);
      const bg = sectionBackgroundClass(sections[1] ?? {});
      expect(bg).toMatch(/gradient/i);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    '5-turn with noise: focus stack survives intervening unrelated edit context',
    async () => {
      workspacePath = await createSyntheticWorkspace({
        site: {
          sections: [
            { type: 'services', title: 'Services' },
            { type: 'gallery', title: 'New Gallery' },
            { type: 'faq', title: 'FAQ' },
          ],
        },
        pageMode: 'wired',
        tailwind: 'canonical',
      });
      await seedSingleImageGallerySection(workspacePath, 1);

      const noisyHistory = [
        ...conversationAfterCaptionTurn(),
        { role: 'user' as const, content: 'change the FAQ section title' },
        { role: 'assistant' as const, content: 'Updated the page content.' },
      ];

      const stack = buildEditFocusStackAfterEdit({
        priorStack: focusAfterCaptionTurn(1),
        result: {
          ok: true,
          strategy: 'section_config',
          editFocus: {
            kind: 'section_copy',
            sectionIndex: 2,
            sectionTitle: 'FAQ',
            at: new Date().toISOString(),
          },
        },
      });

      expect(stack.items[0]!.kind).toBe('section_copy');

      const result = await runWebsiteEditAgent({
        workspacePath,
        ownerMessage: MULTI_TURN_GRADIENT_USER,
        conversationHistory: noisyHistory,
        editFocusStack: {
          items: [
            editFocusFromLastGalleryEdit(
              {
                sectionIndex: 1,
                title: 'New Gallery',
                imageUrls: ['/uploads/single-new.png'],
                imageCount: 1,
              },
              'gallery_captions'
            ),
            ...stack.items,
          ],
        },
        projectId: 'llm-multi-turn-noise',
        mode: 'gitlab',
        infraBaselineReady: true,
      });

      expect(result.needsClarification, result.ownerMessage).toBeFalsy();
      expect(result.ok, result.error ?? result.ownerMessage).toBe(true);

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const sections = parseSections(siteConfig);
      expect(sectionBackgroundClass(sections[1] ?? {})).toMatch(/gradient/i);
    },
    LLM_TEST_TIMEOUT_MS
  );

  it(
    'full LLM chain: image placement → caption → gradient on that section',
    async () => {
      workspacePath = await createSyntheticWorkspace({
        site: {
          sections: [
            { type: 'services', title: 'Services' },
            { type: 'about', title: 'About' },
          ],
        },
        pageMode: 'wired',
        tailwind: 'canonical',
      });
      const attachments = await writeSyntheticUploadFiles(workspacePath, 1, 'chain');

      const placementResult = await runWebsiteEdit({
        workspacePath,
        ownerMessage: MULTI_TURN_IMAGE_USER,
        conversationHistory: [],
        attachments,
        projectId: 'llm-full-chain-t1',
        mode: 'gitlab',
        infraStatus: 'ready',
        infraVersion: 1,
      });

      mustSucceed(placementResult, placementResult.error ?? placementResult.ownerMessage);
      expect(placementResult.editFocusStack?.items.length).toBeGreaterThan(0);
      expect(placementResult.lastGalleryEdit?.imageCount).toBe(1);

      const captionResult = await runWebsiteEdit({
        workspacePath,
        ownerMessage: MULTI_TURN_CAPTION_USER,
        conversationHistory: [
          { role: 'user', content: MULTI_TURN_IMAGE_USER },
          {
            role: 'assistant',
            content: placementResult.ownerMessage ?? 'Added your product section with 1 image(s).',
          },
        ],
        editFocusStack: placementResult.editFocusStack,
        lastGalleryEdit: placementResult.lastGalleryEdit,
        projectId: 'llm-full-chain-t2',
        mode: 'gitlab',
        infraStatus: 'ready',
        infraVersion: 1,
      });

      mustSucceed(captionResult, captionResult.error ?? captionResult.ownerMessage);
      expect(captionResult.strategy).toBe('gallery_captions');

      const galleryIndex =
        captionResult.editFocusStack?.items.find(
          (f) => f.kind === 'gallery_captions' || f.kind === 'section_created'
        )?.sectionIndex ?? placementResult.lastGalleryEdit?.sectionIndex;

      expect(galleryIndex).toBeDefined();

      const gradientResult = await runWebsiteEdit({
        workspacePath,
        ownerMessage: MULTI_TURN_GRADIENT_USER,
        conversationHistory: [
          { role: 'user', content: MULTI_TURN_IMAGE_USER },
          {
            role: 'assistant',
            content: placementResult.ownerMessage ?? '',
          },
          { role: 'user', content: MULTI_TURN_CAPTION_USER },
          {
            role: 'assistant',
            content: captionResult.ownerMessage ?? MULTI_TURN_CAPTION_USER,
          },
        ],
        editFocusStack: captionResult.editFocusStack,
        projectId: 'llm-full-chain-t3',
        mode: 'gitlab',
        infraStatus: 'ready',
        infraVersion: 1,
      });

      mustSucceed(gradientResult, gradientResult.error ?? gradientResult.ownerMessage);

      const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
      const sections = parseSections(siteConfig);
      const targetSection = sections[galleryIndex!] ?? sections[1];
      expect(sectionBackgroundClass(targetSection ?? {})).toMatch(/gradient/i);
    },
    LLM_TEST_TIMEOUT_MS * 3
  );
});
