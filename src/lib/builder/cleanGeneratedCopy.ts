/**
 * Cleans generated copy by removing markdown artifacts from siteSpec strings.
 * - Removes markdown heading prefixes (# ## ###)
 * - Removes markdown bold markers (**)
 * - Trims whitespace and collapses excessive newlines
 * - Does not alter URLs, phone numbers, or email addresses
 */
export function cleanGeneratedCopy(value: unknown): unknown {
  if (typeof value === 'string') {
    return cleanString(value);
  }
  if (Array.isArray(value)) {
    return value.map(item => cleanGeneratedCopy(item));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = cleanGeneratedCopy(v);
    }
    return result;
  }
  return value;
}

function cleanString(str: string): string {
  if (typeof str !== 'string') return str;

  // Remove markdown heading prefixes at start of string or after newline
  let cleaned = str
    // Remove leading # ## ### prefixes (with optional leading whitespace)
    .replace(/^#+\s+/gm, '')
    // Remove bold markers (**text** -> text)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    // Collapse 3+ consecutive newlines into 2
    .replace(/\n{3,}/g, '\n\n')
    // Trim each line
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    // Final trim
    .trim();

  // If entire string is empty after cleaning, return empty
  if (cleaned.replace(/\s/g, '').length === 0) {
    return '';
  }

  return cleaned;
}

/**
 * Checks if a string contains unresolved template placeholders.
 */
export function containsTemplateTokens(value: string): boolean {
  if (typeof value !== 'string') return false;
  const tokens = [
    '{contentSectionsHtml}',
    '{contactSectionHtml}',
    'contentSectionsHtml',
    'contactSectionHtml',
    '__CONTENT_SECTIONS__',
    '__CONTACT_SECTION__',
    '__THEME_PRESET_JSON__',
    '__TEMPLATE_CATEGORY__',
    '__TEMPLATE_VARIANT__',
    '${',
    '\\${',
    'escapedSiteSpec',
    '{htmlSection}',
    'htmlSection',
  ];
  return tokens.some(token => value.includes(token));
}

/**
 * Checks if a string contains markdown heading artifacts inside what looks like visible copy.
 * Only checks within string literals (simplified heuristic).
 */
export function containsMarkdownHeadings(value: string): boolean {
  if (typeof value !== 'string') return false;
  // Check for markdown headings at start of lines within the string
  // This catches raw markdown copied into JSX strings
  return /^#{1,3}\s+\S/m.test(value);
}