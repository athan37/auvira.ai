import * as cheerio from 'cheerio';

/**
 * Extract visible text from HTML.
 * Returns both visibleText and importantText.
 */
export function extractVisibleText(html: string): {
  visibleText: string;
  importantText: string;
} {
  const $ = cheerio.load(html);

  // Remove noisy elements
  $('script, style, noscript, svg, embed, object, iframe, form, button').remove();

  // Get visible text from body
  let visibleText = $('body').text() || '';

  // Normalize whitespace
  visibleText = visibleText.replace(/\s+/g, ' ').trim();

  // Collapse very repeated lines (which often indicate boilerplate)
  const sentences = visibleText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 5);
  const collapsedSentences: string[] = [];
  let repeatCount = 0;
  let prevSentence = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed === prevSentence) {
      repeatCount++;
      if (repeatCount <= 2) {
        collapsedSentences.push(trimmed);
      }
    } else {
      repeatCount = 0;
      collapsedSentences.push(trimmed);
      prevSentence = trimmed;
    }
  }

  visibleText = collapsedSentences.join(' ');

  // Important text: title, meta, headings, first paragraph, contact info
  const title = $('title').text().trim();
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';
  const h1 = $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const h2 = $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const h3 = $('h3').map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const firstP = $('p').first().text().trim();
  const contactInfo = $('address').text().trim();

  const importantParts: string[] = [];
  if (title) importantParts.push(title);
  if (metaDesc) importantParts.push(metaDesc);
  importantParts.push(...h1, ...h2, ...h3);
  if (firstP && firstP.length > 20) importantParts.push(firstP);
  if (contactInfo) importantParts.push(contactInfo);

  const importantText = importantParts.join(' | ');

  return { visibleText, importantText };
}

/**
 * Legacy function for backward compatibility
 */
export function extractTextOnly(html: string): string {
  return extractVisibleText(html).visibleText;
}