/** Default wait before retrying a Gemini rate-limit (429) response. */
export const GEMINI_RATE_LIMIT_RETRY_MS = 5000;

const NON_RETRYABLE_QUOTA = /prepayment credits are depleted|check your plan and billing/i;

/** Parse `Gemini API error: 429 ...` style messages from generateContent failures. */
export function parseGeminiApiErrorStatus(message: string): number | null {
  const match = message.match(/Gemini API error:\s*(\d{3})\b/i);
  if (!match) return null;
  const status = Number.parseInt(match[1], 10);
  return Number.isFinite(status) ? status : null;
}

/**
 * Returns milliseconds to wait before retrying, or null when retry won't help.
 * Honors Google's "Please retry in Xs" hint when present; otherwise 5s for 429.
 */
export function geminiRetryDelayMs(message: string): number | null {
  if (NON_RETRYABLE_QUOTA.test(message)) return null;

  const status = parseGeminiApiErrorStatus(message);
  if (status !== 429) return null;

  const retryIn = message.match(/retry in ([\d.]+)s/i);
  if (retryIn) {
    const seconds = Number.parseFloat(retryIn[1]);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds * 1000);
    }
  }

  return GEMINI_RATE_LIMIT_RETRY_MS;
}
