import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import {
  resolveEditPreviewVerification,
  verifyPreviewForPrompt,
} from '@/lib/project-workspace/verifyPreviewForPrompt';
import * as previewReflects from '@/lib/project-workspace/previewReflectsSiteConfig';
import {
  genericColorWouldPassButExactClassMissing,
  htmlContainsExactPresentationClass,
  waitForPresentationClassInPreview,
} from '@/lib/project-workspace/previewReflectsSiteConfig';

const PROMPT = 'change testimonials section background to red';
const EXPECTED_CLASS = 'bg-red-200';

const SITE_CONFIG = `export const siteConfig = {
  sections: [
    {
      type: "testimonials",
      title: "What Our Customers Say",
      presentation: { backgroundClass: "${EXPECTED_CLASS}" }
    }
  ]
};`;

const PAGE_WIRED = `function TestimonialsSection({ section }) {
  return <section className={resolveSectionBackground(section, preset)} />;
}`;

function htmlWithUnrelatedRedOnly(): string {
  return [
    '<!doctype html><html><body>',
    '<button class="bg-red-600">Buy</button>',
    '<p class="text-red-500">This product is red hot</p>',
    '<span>red</span>',
    'x'.repeat(2_000),
    '</body></html>',
  ].join('');
}

function htmlWithExactClass(): string {
  return `${htmlWithUnrelatedRedOnly()}<section class="px-4 py-16 ${EXPECTED_CLASS}">`;
}

describe('verifyPreviewForPrompt — exact presentation class', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => htmlWithUnrelatedRedOnly(),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not treat unrelated red styling as success for strict color hints', async () => {
    const html = htmlWithUnrelatedRedOnly();
    expect(htmlContainsExactPresentationClass(html, EXPECTED_CLASS)).toBe(false);
    expect(
      genericColorWouldPassButExactClassMissing(html, PROMPT, [EXPECTED_CLASS])
    ).toBe(true);

    const result = await verifyPreviewForPrompt({
      previewUrl: 'http://127.0.0.1:3999',
      ownerMessage: PROMPT,
      strictHints: true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain(EXPECTED_CLASS);
  });

  it('passes when preview HTML includes the exact siteConfig background class', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => htmlWithExactClass(),
      })
    );

    const result = await verifyPreviewForPrompt({
      previewUrl: 'http://127.0.0.1:3999',
      ownerMessage: PROMPT,
      strictHints: true,
    });
    expect(result.ok).toBe(true);
    expect(result.reason).toContain('red');
  });

  it('resolveEditPreviewVerification polls until exact class appears', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => htmlWithUnrelatedRedOnly(),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => htmlWithUnrelatedRedOnly(),
      })
      .mockResolvedValue({
        ok: true,
        text: async () => htmlWithExactClass(),
      });
    vi.stubGlobal('fetch', fetchMock);

    const sync = await waitForPresentationClassInPreview(
      'http://127.0.0.1:3999',
      [EXPECTED_CLASS],
      { retries: 5, delayMs: 5 }
    );
    expect(sync.ok).toBe(true);
    expect(sync.matchedClass).toBe(EXPECTED_CLASS);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('resolveEditPreviewVerification fails when only unrelated red exists in HTML', async () => {
    vi.spyOn(previewReflects, 'waitForPresentationClassInPreview').mockResolvedValue({
      ok: false,
      reason: `Preview did not include expected class(es) yet: ${EXPECTED_CLASS}`,
    });

    const result = await resolveEditPreviewVerification({
      previewUrl: 'http://127.0.0.1:3999',
      ownerMessage: PROMPT,
      attachments: [],
      isSandbox: false,
      mode: 'gitlab',
      siteConfigContent: SITE_CONFIG,
      pageContent: PAGE_WIRED,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain(EXPECTED_CLASS);
  });

  it('resolveEditPreviewVerification passes when exact class is present', async () => {
    vi.spyOn(previewReflects, 'waitForPresentationClassInPreview').mockResolvedValue({
      ok: true,
      reason: `Preview HTML includes ${EXPECTED_CLASS}`,
      matchedClass: EXPECTED_CLASS,
    });

    const result = await resolveEditPreviewVerification({
      previewUrl: 'http://127.0.0.1:3999',
      ownerMessage: PROMPT,
      attachments: [],
      isSandbox: false,
      mode: 'gitlab',
      siteConfigContent: SITE_CONFIG,
      pageContent: PAGE_WIRED,
    });
    expect(result.ok).toBe(true);
    expect(result.reason).toContain(EXPECTED_CLASS);
  });

  it('reports wiring issue when renderer ignores resolveSectionBackground', async () => {
    const hardcodedPage = `function TestimonialsSection({ section }) {
  return <section className={preset.mutedBg}>{section.title}</section>;
}`;

    const result = await resolveEditPreviewVerification({
      previewUrl: 'http://127.0.0.1:3999',
      ownerMessage: PROMPT,
      attachments: [],
      isSandbox: false,
      mode: 'gitlab',
      siteConfigContent: SITE_CONFIG,
      pageContent: hardcodedPage,
    });
    expect(result.ok).toBe(false);
    expect(result.reason.toLowerCase()).toContain('not wired');
  });
});
