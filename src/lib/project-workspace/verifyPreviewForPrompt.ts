import {
  extractPreviewVerifyHints,
  htmlShowsTailwindColor,
} from './verifyPreviewHints';
import {
  genericColorWouldPassButExactClassMissing,
  presentationWiringIssues,
  resolveExpectedPreviewPresentationClasses,
  waitForPresentationClassInPreview,
} from './previewReflectsSiteConfig';
import {
  verifyEditVisibleInPreview,
  type VerifyPreviewResult,
} from './verifyEditVisibleInPreview';
import { verifyGalleryEditOnSandbox } from './verifySandboxGalleryPreview';
import type { WorkspaceAssetAttachment } from './workspaceAssetTypes';
import type { SiteWorkspaceSnapshot } from './edit-shared/resolveSiteWorkspace';
import type { WorkspaceGateway } from './workspaceGateway';

export type { VerifyPreviewResult };

export interface VerifyPreviewForPromptInput {
  previewUrl: string;
  ownerMessage: string;
  imagePaths?: string[];
  /** When true, require at least one color/phrase match (not only HTTP 200). */
  strictHints?: boolean;
}

/**
 * Generic preview verification from owner message (colors, quoted copy, images).
 */
export async function verifyPreviewForPrompt(
  input: VerifyPreviewForPromptInput
): Promise<VerifyPreviewResult> {
  const hints = extractPreviewVerifyHints(input.ownerMessage);
  const imagePaths = input.imagePaths ?? [];

  const base = await verifyEditVisibleInPreview({
    previewUrl: input.previewUrl,
    imagePaths,
    sectionPhrases: hints.phrases.length > 0 ? hints.phrases : undefined,
    timeoutMs: 22_000,
  });

  if (!base.ok && imagePaths.length === 0) {
    return base;
  }

  if (!base.ok && imagePaths.length > 0) {
    return base;
  }

  const html = await fetchPreviewHtml(input.previewUrl);
  if (!html || html.length < 1500) {
    return {
      ok: false,
      reason: 'Preview HTML too short to verify edit.',
      htmlLength: html?.length ?? 0,
      imagesFound: base.imagesFound,
      phraseMatched: false,
    };
  }

  const colorHits = hints.colors.filter((c) => htmlShowsTailwindColor(html, c));
  const phraseHits = hints.phrases.filter((p) =>
    html.toLowerCase().includes(p.toLowerCase())
  );

  if (imagePaths.length > 0 && base.imagesFound > 0) {
    return {
      ok: true,
      reason:
        colorHits.length > 0
          ? `Preview shows images and ${colorHits[0]} styling.`
          : `Preview shows ${base.imagesFound}/${imagePaths.length} uploaded image(s).`,
      htmlLength: html.length,
      imagesFound: base.imagesFound,
      phraseMatched: phraseHits.length > 0 || base.phraseMatched,
    };
  }

  if (colorHits.length > 0) {
    const expectedFromMessage = resolveExpectedPreviewPresentationClasses(
      null,
      input.ownerMessage
    );
    if (
      input.strictHints &&
      expectedFromMessage.length > 0 &&
      genericColorWouldPassButExactClassMissing(html, input.ownerMessage, expectedFromMessage)
    ) {
      return {
        ok: false,
        reason: `Preview shows ${colorHits.join(', ')} styling elsewhere but not exact class ${expectedFromMessage.join(', ')}.`,
        htmlLength: html.length,
        imagesFound: base.imagesFound,
        phraseMatched: false,
      };
    }
    return {
      ok: true,
      reason: `Preview HTML includes ${colorHits.join(', ')} styling.`,
      htmlLength: html.length,
      imagesFound: base.imagesFound,
      phraseMatched: phraseHits.length > 0,
    };
  }

  if (phraseHits.length > 0) {
    return {
      ok: true,
      reason: `Preview HTML includes requested text: "${phraseHits[0]}".`,
      htmlLength: html.length,
      imagesFound: base.imagesFound,
      phraseMatched: true,
    };
  }

  if (input.strictHints && (hints.colors.length > 0 || hints.phrases.length > 0)) {
    return {
      ok: false,
      reason:
        hints.colors.length > 0
          ? `Preview loaded but did not show requested color(s): ${hints.colors.join(', ')}.`
          : 'Preview loaded but requested text was not found in the page HTML.',
      htmlLength: html.length,
      imagesFound: base.imagesFound,
      phraseMatched: false,
    };
  }

  if (hints.isStyleRequest || hints.isCopyRequest) {
    return {
      ok: true,
      reason: 'Preview loaded after edit (style/copy; no strict color/phrase match required).',
      htmlLength: html.length,
      imagesFound: base.imagesFound,
      phraseMatched: base.phraseMatched,
    };
  }

  return {
    ok: true,
    reason: base.reason || 'Preview HTML loaded after edit.',
    htmlLength: html.length,
    imagesFound: base.imagesFound,
    phraseMatched: base.phraseMatched,
  };
}

async function fetchPreviewHtml(previewUrl: string): Promise<string | null> {
  try {
    const sep = previewUrl.includes('?') ? '&' : '?';
    const res = await fetch(`${previewUrl}${sep}_hints=${Date.now()}`, {
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(18_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export interface ResolveEditPreviewVerificationInput {
  previewUrl: string;
  projectId?: string;
  ownerMessage: string;
  attachments: WorkspaceAssetAttachment[];
  isSandbox: boolean;
  mode: 'gitlab' | 'static';
  workspaceSnap?: SiteWorkspaceSnapshot;
  gateway?: WorkspaceGateway;
  /** Fresh siteConfig.ts after edit — used for presentation class sync checks. */
  siteConfigContent?: string;
  /** Fresh page.tsx — used to detect hardcoded section backgrounds. */
  pageContent?: string;
  /** Override poll timing (tests / fast settle). */
  presentationPoll?: { retries?: number; delayMs?: number };
}

/**
 * Pick gallery vs prompt-based preview verification for an edit job.
 */
export async function resolveEditPreviewVerification(
  input: ResolveEditPreviewVerificationInput
): Promise<VerifyPreviewResult> {
  const imagePaths = input.attachments.map((a) => a.publicUrl);

  if (imagePaths.length > 0 && input.mode === 'gitlab') {
    const snap = input.workspaceSnap;
    let siteConfigAfter = snap?.siteConfigContent ?? '';
    let pageAfter = snap?.pageContent ?? '';

    if ((!siteConfigAfter || !pageAfter) && input.gateway && snap) {
      if (!siteConfigAfter && snap.siteConfigPath) {
        siteConfigAfter =
          (await input.gateway.readFile(snap.siteConfigPath).catch(() => '')) || '';
      }
      if (!pageAfter && snap.pagePath) {
        pageAfter = (await input.gateway.readFile(snap.pagePath).catch(() => '')) || '';
      }
    }

    if (siteConfigAfter && pageAfter) {
      const hints = extractPreviewVerifyHints(input.ownerMessage);
      const gallery = await verifyGalleryEditOnSandbox({
        previewUrl: input.previewUrl,
        projectId: input.projectId,
        siteConfigSource: siteConfigAfter,
        pageSource: pageAfter,
        attachments: input.attachments,
        sectionPhrases: hints.phrases,
      });
      return { ...gallery, phraseMatched: gallery.imagesFound > 0 };
    }
  }

  if (imagePaths.length > 0) {
    return verifyEditVisibleInPreview({
      previewUrl: input.previewUrl,
      imagePaths,
      sectionPhrases: [
        'Our products',
        'Our work',
        'Gallery',
        'Product documentation',
        'Product images',
        'Featured Product',
      ],
    });
  }

  const hints = extractPreviewVerifyHints(input.ownerMessage);
  const strictColorHints =
    hints.isTextColorRequest || hints.isBackgroundColorRequest;

  let siteConfigAfter = input.siteConfigContent ?? '';
  if (!siteConfigAfter && input.workspaceSnap?.siteConfigContent) {
    siteConfigAfter = input.workspaceSnap.siteConfigContent;
  }
  if (!siteConfigAfter && input.gateway) {
    siteConfigAfter =
      (await input.gateway.readFile('src/lib/siteConfig.ts').catch(() => '')) || '';
  }

  let pageAfter = input.pageContent ?? '';
  if (!pageAfter && input.workspaceSnap?.pageContent) {
    pageAfter = input.workspaceSnap.pageContent;
  }
  if (!pageAfter && input.gateway) {
    pageAfter =
      (await input.gateway.readFile('src/app/page.tsx').catch(() => '')) || '';
  }

  if (
    strictColorHints &&
    siteConfigAfter.includes('presentation') &&
    (siteConfigAfter.includes('backgroundClass') || siteConfigAfter.includes('cardClass'))
  ) {
    const wiringIssues = pageAfter
      ? presentationWiringIssues(siteConfigAfter, pageAfter)
      : [];
    if (wiringIssues.length > 0) {
      return {
        ok: false,
        reason: `Saved siteConfig.presentation but preview renderer is not wired: ${wiringIssues.join('; ')}`,
        htmlLength: 0,
        imagesFound: 0,
        phraseMatched: false,
      };
    }

    const expectedClasses = resolveExpectedPreviewPresentationClasses(
      siteConfigAfter,
      input.ownerMessage
    );
    const sync = await waitForPresentationClassInPreview(
      input.previewUrl,
      expectedClasses,
      input.presentationPoll
    );
    if (sync.ok) {
      return {
        ok: true,
        reason: sync.reason,
        htmlLength: 0,
        imagesFound: 0,
        phraseMatched: false,
        presentationClassPolled: true,
      };
    }
    return {
      ok: false,
      reason: sync.reason,
      htmlLength: 0,
      imagesFound: 0,
      phraseMatched: false,
      presentationClassPolled: true,
    };
  }

  return verifyPreviewForPrompt({
    previewUrl: input.previewUrl,
    ownerMessage: input.ownerMessage,
    strictHints: hints.phrases.length > 0 || strictColorHints,
  });
}
