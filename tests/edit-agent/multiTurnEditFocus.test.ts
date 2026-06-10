import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { runWebsiteEditAgent } from '@/lib/project-workspace/edit-agent';
import { runWebsiteEdit } from '@/lib/project-workspace/websiteEditRunner';
import { createSyntheticWorkspace, readSyntheticFile } from '../support/syntheticSiteWorkspace';
import { parseSections, sectionBackgroundClass } from './editHarness';
import {
  conversationAfterCaptionTurn,
  focusAfterCaptionTurn,
  focusAfterImagePlacement,
  MULTI_TURN_CAPTION_USER,
  MULTI_TURN_GRADIENT_USER,
  seedSingleImageGallerySection,
} from '../support/multiTurnEditFocusScenario';

vi.mock('@/lib/project-workspace/planner/llmClient', () => ({
  getLLMClient: vi.fn(),
}));

import { getLLMClient } from '@/lib/project-workspace/planner/llmClient';

describe('multi-turn edit focus (deterministic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('T3 without focus stack asks for clarification on that section', async () => {
    const workspacePath = await createSyntheticWorkspace({
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

    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: MULTI_TURN_GRADIENT_USER,
      conversationHistory: conversationAfterCaptionTurn(),
      editFocusStack: { items: [] },
      infraBaselineReady: true,
    });

    expect(built.needsClarification).toBe(true);
    expect(built.clarificationMessage).toMatch(/which section/i);
  });

  it('T3: buildEditContext resolves that section via focus stack after caption turn', async () => {
    const workspacePath = await createSyntheticWorkspace({
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

    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: MULTI_TURN_GRADIENT_USER,
      conversationHistory: conversationAfterCaptionTurn(),
      editFocusStack: focusAfterCaptionTurn(1),
      infraBaselineReady: true,
    });

    expect(built.needsClarification).toBe(false);
    expect(built.context.target.sectionIndex).toBe(1);
    expect(built.context.target.confidence).toBe('high');
    expect(built.context.effectiveMessage).toMatch(/section index 1/i);
  });

  it('4-turn chain: gradient on that section applies to gallery section index 1', async () => {
    const workspacePath = await createSyntheticWorkspace({
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
      projectId: 'multi-turn-gradient',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const sections = parseSections(siteConfig);
    const bg = sectionBackgroundClass(sections[1] ?? {});
    expect(bg, 'expected gradient background on gallery section').toMatch(/gradient/i);
  });

  it('T3: blue-to-green gradient phrasing resolves via focus stack', async () => {
    const workspacePath = await createSyntheticWorkspace({
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
      ownerMessage: 'change background of that section to blue to green gradient',
      conversationHistory: conversationAfterCaptionTurn(),
      editFocusStack: focusAfterCaptionTurn(1),
      projectId: 'multi-turn-blue-green',
      mode: 'gitlab',
      infraBaselineReady: true,
    });

    expect(result.needsClarification, result.ownerMessage).toBeFalsy();
    expect(result.ok, result.error ?? result.ownerMessage).toBe(true);

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(sectionBackgroundClass(parseSections(siteConfig)[1] ?? {})).toMatch(/gradient/i);
  });

  it('full chain via runWebsiteEdit: caption then gradient propagates focus stack', async () => {
    const workspacePath = await createSyntheticWorkspace({
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

    const siteBefore = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    const withCaption = siteBefore.replace(
      "description: 'Professional work showcase.'",
      "description: 'This is a substantially longer full-chain caption used to satisfy edit verification minimum change thresholds.'"
    );

    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          files: [{ path: 'src/lib/siteConfig.ts', content: withCaption }],
          summary: 'Added descriptions under your product images.',
        },
      }),
    } as ReturnType<typeof getLLMClient>);

    const captionResult = await runWebsiteEdit({
      workspacePath,
      ownerMessage: MULTI_TURN_CAPTION_USER,
      conversationHistory: [
        { role: 'user', content: 'add this image to a new section' },
        {
          role: 'assistant',
          content:
            'Added your product section with 1 image(s) in the preview. Scroll just below the hero to see it.',
        },
      ],
      editFocusStack: focusAfterImagePlacement(1),
      projectId: 'multi-turn-chain-caption',
      mode: 'gitlab',
      infraStatus: 'ready',
      infraVersion: 1,
    });

    expect(captionResult.ok, captionResult.error ?? captionResult.ownerMessage).toBe(true);
    expect(captionResult.strategy).toBe('gallery_captions');
    expect(captionResult.editFocusStack?.items[0]?.kind).toBe('gallery_captions');
    expect(captionResult.editFocusStack?.items[0]?.sectionIndex).toBe(1);

    const gradientResult = await runWebsiteEdit({
      workspacePath,
      ownerMessage: MULTI_TURN_GRADIENT_USER,
      conversationHistory: conversationAfterCaptionTurn(),
      editFocusStack: captionResult.editFocusStack,
      projectId: 'multi-turn-chain-gradient',
      mode: 'gitlab',
      infraStatus: 'ready',
      infraVersion: 1,
    });

    expect(gradientResult.needsClarification, gradientResult.ownerMessage).toBeFalsy();
    expect(gradientResult.ok, gradientResult.error ?? gradientResult.ownerMessage).toBe(true);
    expect(gradientResult.editFocusStack?.items[0]?.kind).toBe('section_style');

    const siteConfig = await readSyntheticFile(workspacePath, 'src/lib/siteConfig.ts');
    expect(sectionBackgroundClass(parseSections(siteConfig)[1] ?? {})).toMatch(/gradient/i);
  });
});
