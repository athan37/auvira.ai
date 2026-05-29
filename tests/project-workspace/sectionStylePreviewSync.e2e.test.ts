import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { runSectionStyleStrategy } from '@/lib/project-workspace/website-edit-agent/strategies/sectionStyleStrategy';
import { SITECONFIG_PRESENTATION_SYNC_EXPORT } from '@/lib/site-manager/siteConfigAgentMarkers';
import { colorNameToBackgroundClass } from '@/lib/builder/sectionPresentation';
import { resolveEditStreamPreviewOutcome } from '@/lib/project-workspace/previewStability';
import { resolveEditPreviewVerification } from '@/lib/project-workspace/verifyPreviewForPrompt';
import { extractPreviewVerifyHints } from '@/lib/project-workspace/verifyPreviewHints';
import type { WebsiteEditAgentOptions } from '@/lib/project-workspace/website-edit-agent/types';
import {
  PAGE_SOURCE,
  SITE_CONFIG_SOURCE,
} from '../website-agent-v2/presentationWorkspace';

vi.mock('@/lib/project-workspace/verifyEditVisibleInPreview', () => ({
  verifyEditVisibleInPreview: vi.fn().mockResolvedValue({
    ok: true,
    reason: 'Preview HTML loaded',
    htmlLength: 5_000,
    imagesFound: 0,
    phraseMatched: false,
  }),
}));

vi.mock('@/lib/project-workspace/verifySandboxGalleryPreview', () => ({
  verifyGalleryEditOnSandbox: vi.fn(),
}));

const PROMPT = 'Change the testimonials section background to red';
const EXPECTED_CLASS = colorNameToBackgroundClass('red');

const TESTIMONIALS_PLAN: NonNullable<WebsiteEditAgentOptions['editTargetPlan']> = {
  what: 'style_background',
  valueExplicit: true,
  structureBrief: '',
  codeBlocks: [],
  where: {
    kind: 'section',
    confidence: 'high',
    sectionIndex: 3,
    sectionType: 'testimonials',
    title: 'What Our Customers Say',
    rendererComponent: 'TestimonialsSection',
    matches: [],
  },
};

function htmlNoiseWithoutExactClass(): string {
  return [
    '<button class="bg-red-600">x</button>',
    '<p class="text-red-500">red</p>',
    'x'.repeat(2_000),
  ].join('');
}

describe('section style preview sync e2e (no LLM)', () => {
  let workspacePath: string;
  let files: Map<string, string>;

  beforeEach(async () => {
    workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), 'section-style-sync-'));
    files = new Map([
      ['src/lib/siteConfig.ts', SITE_CONFIG_SOURCE],
      ['src/app/page.tsx', PAGE_SOURCE],
      ['src/app/globals.css', 'body {}'],
    ]);
    for (const [rel, content] of files) {
      const dest = path.join(workspacePath, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, content, 'utf-8');
    }
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await fs.rm(workspacePath, { recursive: true, force: true });
  });

  it('classifies testimonials background prompt as strict color verify', () => {
    const hints = extractPreviewVerifyHints(PROMPT);
    expect(hints.isBackgroundColorRequest).toBe(true);
    expect(hints.colors).toContain('red');
  });

  it('section_style writes bg-red-200, sync export, and only siteConfig', async () => {
    const hashes: Record<string, string> = {
      'src/lib/siteConfig.ts': 'cfg-0',
      'src/app/page.tsx': 'page-0',
    };
    const gateway = {
      readFile: vi.fn(async (rel: string) => files.get(rel) ?? null),
      writeFile: vi.fn(async (rel: string, content: string) => {
        files.set(rel, content);
        if (rel === 'src/lib/siteConfig.ts') {
          hashes[rel] = `cfg-${Date.now()}`;
        }
      }),
      computeHashes: vi.fn(async () => ({ ...hashes })),
    };

    const options: WebsiteEditAgentOptions = {
      workspacePath,
      ownerMessage: PROMPT,
      projectId: 'e2e-section-style',
      mode: 'gitlab',
      gateway: gateway as unknown as WebsiteEditAgentOptions['gateway'],
      editTargetPlan: TESTIMONIALS_PLAN,
      infraBaselineReady: true,
    };

    const beforeHashes = await gateway.computeHashes();
    const result = await runSectionStyleStrategy(options, beforeHashes);
    expect(result?.ok).toBe(true);
    expect(result?.changedFiles).toContain('src/lib/siteConfig.ts');
    expect(result?.changedFiles).not.toContain('src/app/page.tsx');

    const siteConfig = files.get('src/lib/siteConfig.ts') ?? '';
    expect(siteConfig).toContain(`"backgroundClass": "${EXPECTED_CLASS}"`);
    expect(siteConfig).toContain(SITECONFIG_PRESENTATION_SYNC_EXPORT);
    expect(files.get('src/app/page.tsx')).toBe(PAGE_SOURCE);
  });

  it('preview verify polls for exact class and soft-passes when preview lags', async () => {
    const hashes: Record<string, string> = {
      'src/lib/siteConfig.ts': 'cfg-0',
      'src/app/page.tsx': 'page-0',
    };
    const gateway = {
      readFile: vi.fn(async (rel: string) => files.get(rel) ?? null),
      writeFile: vi.fn(async (rel: string, content: string) => {
        files.set(rel, content);
        if (rel === 'src/lib/siteConfig.ts') {
          hashes[rel] = `cfg-${Date.now()}`;
        }
      }),
      computeHashes: vi.fn(async () => ({ ...hashes })),
    };
    const beforeHashes = await gateway.computeHashes();
    await runSectionStyleStrategy(
      {
        workspacePath,
        ownerMessage: PROMPT,
        projectId: 'e2e-verify-lag',
        mode: 'gitlab',
        gateway: gateway as unknown as WebsiteEditAgentOptions['gateway'],
        editTargetPlan: TESTIMONIALS_PLAN,
        infraBaselineReady: true,
      },
      beforeHashes
    );

    const siteConfig = files.get('src/lib/siteConfig.ts') ?? '';
    const page = files.get('src/app/page.tsx') ?? '';
    expect(siteConfig).toContain(EXPECTED_CLASS);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => htmlNoiseWithoutExactClass(),
    });
    vi.stubGlobal('fetch', fetchMock);

    const poll = { retries: 4, delayMs: 15 };
    const verifyStart = Date.now();
    const verify = await resolveEditPreviewVerification({
      previewUrl: 'http://127.0.0.1:3999',
      ownerMessage: PROMPT,
      attachments: [],
      isSandbox: false,
      mode: 'gitlab',
      siteConfigContent: siteConfig,
      pageContent: page,
      presentationPoll: poll,
    });
    const verifyElapsed = Date.now() - verifyStart;

    expect(verify.presentationClassPolled).toBe(true);
    expect(verify.ok).toBe(false);
    expect(verify.reason).toContain(EXPECTED_CLASS);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(verifyElapsed).toBeGreaterThan(30);

    const outcome = resolveEditStreamPreviewOutcome({
      sourceValidationPassed: true,
      editApplied: true,
      previewVerify: verify,
      previewVerifySkipped: false,
      defaultSuccessMessage: 'Changed background.',
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.editApplied).toBe(true);
    expect(outcome.previewSynced).toBe(false);
    expect(outcome.ownerMessage).toContain('Preview is still syncing');
  });

  it('preview verify passes when exact class appears after polling', async () => {
    const siteConfig = `export const siteConfig = { sections: [{ type: "testimonials", presentation: { backgroundClass: "${EXPECTED_CLASS}" } }] };`;
    const page = PAGE_SOURCE;

    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        calls += 1;
        const html =
          calls < 3
            ? htmlNoiseWithoutExactClass()
            : `${htmlNoiseWithoutExactClass()}<section class="${EXPECTED_CLASS}">`;
        return { ok: true, text: async () => html };
      })
    );

    const verify = await resolveEditPreviewVerification({
      previewUrl: 'http://127.0.0.1:3999',
      ownerMessage: PROMPT,
      attachments: [],
      isSandbox: false,
      mode: 'gitlab',
      siteConfigContent: siteConfig,
      pageContent: page,
      presentationPoll: { retries: 5, delayMs: 10 },
    });

    expect(verify.presentationClassPolled).toBe(true);
    expect(verify.ok).toBe(true);
    expect(verify.reason).toContain(EXPECTED_CLASS);
    expect(calls).toBeGreaterThanOrEqual(3);
  });
});
