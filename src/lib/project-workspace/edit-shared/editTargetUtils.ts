/** Owner gave a concrete target value (e.g. "to Built for Houston" or "to: Built for Houston"). */
export function hasExplicitEditTarget(message: string): boolean {
  const lower = message.toLowerCase();
  if (/\bto\s+["'].+["']/.test(message)) return true;
  if (/\bto\s*:?\s+[A-Za-z0-9][\w\s,'-]{2,}/.test(message)) return true;
  if (/\b(set|make|update)\s+.+\s+(to|as)\s+/i.test(message)) return true;
  if (lower.includes('faq') && /\d+/.test(message)) return true;
  return false;
}
