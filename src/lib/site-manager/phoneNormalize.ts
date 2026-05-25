export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function extractPhoneDigitsFromText(text: string): string[] {
  const matches = text.match(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g) ?? [];
  const normalized = matches.map((m) => normalizePhone(m)).filter((d) => d.length >= 10);
  return [...new Set(normalized.map((d) => (d.length === 11 && d.startsWith('1') ? d.slice(1) : d)))];
}

export function phoneMatchesInHtml(expectedPhone: string, html: string): boolean {
  const expected = normalizePhone(expectedPhone);
  if (expected.length < 10) return false;
  const expected10 = expected.length === 11 && expected.startsWith('1') ? expected.slice(1) : expected;
  const found = extractPhoneDigitsFromText(html);
  if (found.includes(expected10)) return true;
  return html.replace(/\D/g, '').includes(expected10);
}

export function findConflictingPhone(expectedPhone: string, html: string): string | null {
  const expected = normalizePhone(expectedPhone);
  const expected10 = expected.length === 11 && expected.startsWith('1') ? expected.slice(1) : expected;
  for (const digits of extractPhoneDigitsFromText(html)) {
    if (digits !== expected10 && digits.length >= 10) return digits;
  }
  return null;
}
