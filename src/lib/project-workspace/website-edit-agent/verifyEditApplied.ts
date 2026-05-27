import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { isTextColorEditRequest } from '../verifyPreviewHints';
import { detectScopedStyleRequest } from './editAmbiguity';
import {
  extractPresetObjectLiteral,
  PRESET_BACKGROUND_KEYS,
} from './preset/presetUtils';

export interface VerifyResult {
  ok: boolean;
  reason: string;
  evidence: string[];
}

function getVisibleText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ');
}

function messageHasKeyword(message: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(message);
}

function findPageTsxContent(files: Record<string, string>): string | null {
  for (const [filePath, content] of Object.entries(files)) {
    if (/src\/app\/page\.tsx$/i.test(filePath.replace(/\\/g, '/'))) {
      return content;
    }
  }
  return null;
}

function extractPresetBackgroundClasses(pageContent: string): string {
  const presetJson = extractPresetObjectLiteral(pageContent);
  if (!presetJson) return pageContent;
  const values: string[] = [];
  for (const key of PRESET_BACKGROUND_KEYS) {
    const km = presetJson.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, 'i'));
    if (km?.[1]) values.push(km[1]);
  }
  return values.length > 0 ? values.join(' ') : pageContent;
}

/** Match Tailwind bg/from/to/via classes and gradient stops (e.g. from-green-800). */
function tailwindBackgroundUsesColor(text: string, color: string): boolean {
  const escaped = color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    new RegExp(`(?:bg-|from-|to-|via-)${escaped}(?:-[0-9]{2,3})?(?:\\s|"|'|$)`, 'i').test(text) ||
    new RegExp(`(?:^|[\\s/"'])${escaped}-[0-9]{2,3}(?:\\s|"|'|$)`, 'i').test(text)
  );
}

/** Tailwind sites store colors in page.tsx preset — globals.css alone won't update the preview. */
function verifyVisibleBackgroundOnPage(
  message: string,
  beforeFiles: Record<string, string>,
  afterFiles: Record<string, string>,
  requestedColors: string[]
): VerifyResult | null {
  const lowerMsg = message.toLowerCase();
  const isBackgroundRequest =
    messageHasKeyword(lowerMsg, 'background') ||
    messageHasKeyword(lowerMsg, 'colour') ||
    messageHasKeyword(lowerMsg, 'color');

  if (isTextColorEditRequest(message)) {
    return null;
  }

  if (!isBackgroundRequest && requestedColors.length === 0) {
    return null;
  }

  const pageAfter = findPageTsxContent(afterFiles);
  if (!pageAfter) {
    return null;
  }

  const usesPreset = pageAfter.includes('preset') || /\bbg-[a-z]+/.test(pageAfter);
  if (!usesPreset) {
    return null;
  }

  const presetBgBlob = extractPresetBackgroundClasses(pageAfter);
  const pageBgSurface = `${presetBgBlob} ${pageAfter}`;

  const backgroundConflictColors = [
    'green',
    'yellow',
    'red',
    'orange',
    'purple',
    'pink',
    'brown',
  ];

  for (const color of requestedColors) {
    if (!tailwindBackgroundUsesColor(pageBgSurface, color)) {
      continue;
    }

    const conflicting = backgroundConflictColors.filter(
      (c) =>
        c !== color &&
        tailwindBackgroundUsesColor(presetBgBlob, c) &&
        !messageHasKeyword(lowerMsg, c)
    );

    if (isBackgroundRequest && conflicting.length > 0) {
      return {
        ok: false,
        reason: `page.tsx preset still uses ${conflicting.map((c) => `bg-${c}`).join(', ')}; set pageBg/heroBg to ${color} instead.`,
        evidence: conflicting.map((c) => `conflicting ${c} in preset background keys`),
      };
    }

    return {
      ok: true,
      reason: `Visible Tailwind background (${color}) found in page.tsx preset.`,
      evidence: [`${color} present in pageBg/heroBg (including gradients)`],
    };
  }

  if (requestedColors.length === 0) {
    return null;
  }

  const pageBefore = findPageTsxContent(beforeFiles);
  const pageChanged = pageBefore !== null && pageBefore !== pageAfter;
  const pagePath = 'src/app/page.tsx';

  return {
    ok: false,
    reason: `Background color must be updated in src/app/page.tsx (preset pageBg/heroBg and main classes like bg-${requestedColors[0]}), not only CSS comments.`,
    evidence: [
      pageChanged
        ? `${pagePath} changed but no visible bg-${requestedColors[0]} Tailwind classes`
        : `${pagePath} was not updated — preview still uses old preset colors`,
    ],
  };
}

/**
 * Deterministic verification that an edit was actually applied.
 * Verifies the workspace reflects the intended edit before publish.
 */
export function verifyEditApplied(
  message: string,
  beforeFiles: Record<string, string>,
  afterFiles: Record<string, string>
): VerifyResult {
  const lowerMsg = message.toLowerCase();
  const evidence: string[] = [];
  const changedFiles: string[] = [];

  for (const [filename, beforeContent] of Object.entries(beforeFiles)) {
    const afterContent = afterFiles[filename] ?? '';
    if (beforeContent !== afterContent) {
      changedFiles.push(filename);
      evidence.push(`${filename} changed (${beforeContent.length} -> ${afterContent.length})`);
    }
  }

  for (const [filename, afterContent] of Object.entries(afterFiles)) {
    if (!(filename in beforeFiles) && afterContent) {
      changedFiles.push(filename);
      evidence.push(`${filename} added (new file)`);
    }
  }

  if (changedFiles.length === 0) {
    return { ok: false, reason: 'No files were changed.', evidence: [] };
  }

  const sectionKeywords = [
    'section',
    'add',
    'another',
    'new',
    'area',
    'block',
    'paragraph',
    'sentence',
    'content',
    'homes',
    'projects',
    'portfolio',
    'gallery',
    'team',
  ];
  const isSectionRequest = sectionKeywords.some((kw) => messageHasKeyword(lowerMsg, kw));

  if (isSectionRequest) {
    const htmlChanged = changedFiles.some((f) => /\.(html?|tsx|jsx)$/i.test(f));
    if (htmlChanged) {
      for (const filename of changedFiles) {
        if (!/\.(html?|tsx|jsx)$/i.test(filename)) continue;

        const before = beforeFiles[filename] ?? '';
        const after = afterFiles[filename] ?? '';
        if (before === after) continue;

        const beforeText = getVisibleText(before);
        const afterText = getVisibleText(after);
        const newText = afterText.startsWith(beforeText)
          ? afterText.slice(beforeText.length).trim()
          : afterText.replace(beforeText, '').trim();
        const visibleGrowth = afterText.length - beforeText.length;
        const rawGrowth = after.length - before.length;

        if (newText.length >= 20 || visibleGrowth >= 20 || rawGrowth >= 40) {
          evidence.push(`added ${Math.max(newText.length, visibleGrowth, rawGrowth)} chars of content`);
          return { ok: true, reason: 'Content added and verified.', evidence };
        }
      }
    }

    for (const filename of changedFiles) {
      if (!/siteconfig\.ts$/i.test(filename)) continue;

      const before = beforeFiles[filename] ?? '';
      const after = afterFiles[filename] ?? '';
      if (before === after) continue;

      const growth = after.length - before.length;
      const hasSections = /(?:^|["'\s])sections["']?\s*:/.test(after);
      const hasItems = /(?:^|["'\s])items["']?\s*:\s*\[/.test(after);
      const hasGalleryImages =
        /imageUrl/i.test(after) || /\/uploads\//i.test(after);
      const meaningfulChange = before !== after && Math.abs(growth) >= 10;

      if (!parseSiteConfigSource(after)) {
        return {
          ok: false,
          reason: 'siteConfig.ts is not valid after the edit (parse failed).',
          evidence: [`${filename} failed parseSiteConfigSource`],
        };
      }

      const styleOnlySiteConfig =
        detectScopedStyleRequest(message) &&
        !changedFiles.some((f) => /page\.tsx$/i.test(f.replace(/\\/g, '/')));

      if (styleOnlySiteConfig && meaningfulChange) {
        return {
          ok: false,
          reason:
            'Color or card styling must be updated in src/app/page.tsx (preset/card classes), not siteConfig.ts.',
          evidence: ['siteConfig changed but page.tsx was not updated for scoped style request'],
        };
      }

      if (meaningfulChange && hasSections && (hasItems || hasGalleryImages)) {
        evidence.push(`siteConfig sections updated (${growth >= 0 ? '+' : ''}${growth} chars)`);
        return { ok: true, reason: 'Section content added in siteConfig.', evidence };
      }
    }

    return {
      ok: false,
      reason: 'You asked to add content, but no homepage files (siteConfig or page TSX) were updated with new section data.',
      evidence,
    };
  }

  const styleKeywords = [
    'background',
    'color',
    'colour',
    'font',
    'style',
    'green',
    'yellow',
    'blue',
    'red',
    'orange',
    'purple',
  ];
  const isStyleRequest = styleKeywords.some((kw) => messageHasKeyword(lowerMsg, kw));

  if (isStyleRequest) {
    const cssChanged = changedFiles.some((f) => /\.(css|scss|sass|less)$/i.test(f));
    if (!cssChanged) {
      const htmlChanged = changedFiles.some((f) => /\.(html?|tsx|jsx)$/i.test(f));
      if (!htmlChanged) {
        return {
          ok: false,
          reason: 'You asked to change style, but no CSS or HTML files changed.',
          evidence,
        };
      }
      evidence.push('style changed inline in HTML');
    }

    const colorNames = [
      'green',
      'yellow',
      'blue',
      'red',
      'orange',
      'purple',
      'pink',
      'brown',
      'black',
      'white',
    ];
    const requestedColors = colorNames.filter((c) => messageHasKeyword(lowerMsg, c));

    if (requestedColors.length > 0) {
      const pageCheck = verifyVisibleBackgroundOnPage(
        message,
        beforeFiles,
        afterFiles,
        requestedColors
      );
      if (pageCheck) {
        return pageCheck;
      }

      let colorFound = false;
      for (const filename of changedFiles) {
        const content = (afterFiles[filename] ?? '').toLowerCase();
        for (const color of requestedColors) {
          if (content.includes(color)) {
            colorFound = true;
            evidence.push(`color '${color}' found in ${filename}`);
            break;
          }
        }
        if (colorFound) break;
      }

      if (!colorFound) {
        const hasHexChange = changedFiles.some((f) => /#[0-9a-f]{3,8}/i.test(afterFiles[f] ?? ''));
        if (!hasHexChange) {
          return {
            ok: false,
            reason: `You asked for ${requestedColors[0]} but it was not found in changed files.`,
            evidence,
          };
        }
      }
    }
  }

  return { ok: true, reason: 'Edit verified: files changed appropriately.', evidence };
}

export function summarizeActualChanges(
  message: string,
  beforeFiles: Record<string, string>,
  afterFiles: Record<string, string>
): string {
  const lowerMsg = message.toLowerCase();
  const changedFiles: string[] = [];
  let cssChanged = false;
  let htmlChanged = false;

  for (const [filename, beforeContent] of Object.entries(beforeFiles)) {
    const afterContent = afterFiles[filename] ?? '';
    if (beforeContent !== afterContent) {
      changedFiles.push(filename);
      if (/\.(css|scss|sass|less)$/i.test(filename)) cssChanged = true;
      if (/\.(html?|tsx|jsx|ts|js)$/i.test(filename)) htmlChanged = true;
    }
  }

  for (const filename of Object.keys(afterFiles)) {
    if (!(filename in beforeFiles) && afterFiles[filename]) {
      changedFiles.push(filename);
    }
  }

  if (changedFiles.length === 0) {
    return 'No changes were made.';
  }

  const changes: string[] = [];
  if (htmlChanged) {
    changes.push('Updated the page content.');
  }
  if (cssChanged || lowerMsg.match(/background|color|style/)) {
    changes.push('Updated the styling.');
  }

  if (changes.length === 2) return `${changes[0]} ${changes[1]}`;
  if (changes.length === 1) return changes[0];
  return 'Your website has been updated.';
}
