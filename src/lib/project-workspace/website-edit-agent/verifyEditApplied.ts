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

  /** Preset keys that control page/section backgrounds (not buttons or cards). */
  const presetBgKeys = [
    'pageBg',
    'heroBg',
    'surfaceBg',
    'mutedBg',
    'navBg',
    'contactBg',
    'footerBg',
  ];
  const presetBgBlob = (() => {
    const m = pageAfter.match(/const preset\s*=\s*(\{[\s\S]*?\});/);
    if (!m) return pageAfter;
    const blob: string[] = [];
    for (const key of presetBgKeys) {
      const km = m[1].match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, 'i'));
      if (km) blob.push(km[1]);
    }
    return blob.length > 0 ? blob.join(' ') : pageAfter;
  })();

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
    const tailwindBg = new RegExp(`bg-${color}(?:-\\d{2,3})?`, 'i');
    if (!tailwindBg.test(presetBgBlob)) {
      continue;
    }

    const conflicting = backgroundConflictColors.filter(
      (c) =>
        c !== color &&
        new RegExp(`bg-${c}(?:-\\d{2,3})?`, 'i').test(presetBgBlob) &&
        !messageHasKeyword(lowerMsg, c)
    );

    if (isBackgroundRequest && conflicting.length > 0) {
      return {
        ok: false,
        reason: `page.tsx preset still uses ${conflicting.map((c) => `bg-${c}`).join(', ')}; set pageBg/heroBg to bg-${color} instead.`,
        evidence: conflicting.map((c) => `conflicting bg-${c} in preset background keys`),
      };
    }

    return {
      ok: true,
      reason: `Visible Tailwind background (${color}) found in page.tsx preset.`,
      evidence: [`bg-${color} present in preset background keys`],
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
      const hasSections = /sections\s*:/.test(after);
      const hasItems = /items\s*:\s*\[|"items"\s*:\s*\[/.test(after);
      const meaningfulChange = before !== after && Math.abs(growth) >= 10;

      if (meaningfulChange && hasSections && hasItems) {
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
