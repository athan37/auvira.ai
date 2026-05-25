/**
 * Remove duplicate injected component functions (GallerySection, GenericSection, Footer).
 * Keeps the first definition; drops later copies from failed re-patches or LLM edits.
 */
export function dedupePageComponentFunctions(
  pageContent: string,
  componentName: string
): { content: string; removed: number } {
  const marker = `function ${componentName}`;
  let content = pageContent;
  let removed = 0;

  while (true) {
    const first = content.indexOf(marker);
    if (first < 0) break;
    const second = content.indexOf(marker, first + marker.length);
    if (second < 0) break;

    const end = findFunctionEnd(content, second);
    if (end < 0) break;
    content = content.slice(0, second) + content.slice(end);
    removed += 1;
  }

  return { content, removed };
}

function findFunctionEnd(source: string, startIdx: number): number {
  const braceStart = source.indexOf('{', startIdx);
  if (braceStart < 0) return -1;
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        let end = i + 1;
        while (end < source.length && /[\s;]/.test(source[end]!)) end += 1;
        return end;
      }
    }
  }
  return -1;
}

/** Run safe structural repairs on page.tsx after automated patches. */
export function repairPageTsxStructure(pageContent: string): {
  content: string;
  repaired: boolean;
  notes: string[];
} {
  let content = pageContent;
  const notes: string[] = [];
  let repaired = false;

  for (const name of ['GallerySection', 'GenericSection', 'Footer']) {
    const { content: next, removed } = dedupePageComponentFunctions(content, name);
    if (removed > 0) {
      content = next;
      repaired = true;
      notes.push(`removed ${removed} duplicate ${name}`);
    }
  }

  // Normalize smashed switch cases onto separate lines
  const smashed = /(case\s+['"][^'"]+['"]\s*:\s*return[^;]+;)\s+(case\s+['"])/g;
  if (smashed.test(content)) {
    content = content.replace(smashed, '$1\n    $2');
    repaired = true;
    notes.push('split smashed switch cases');
  }

  return { content, repaired, notes };
}
