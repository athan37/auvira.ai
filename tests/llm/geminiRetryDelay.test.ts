import { describe, expect, it } from 'vitest';
import {
  GEMINI_RATE_LIMIT_RETRY_MS,
  geminiRetryDelayMs,
  parseGeminiApiErrorStatus,
} from '@/lib/llm/geminiRetryDelay';

describe('geminiRetryDelay', () => {
  it('parses Gemini API status codes from error messages', () => {
    expect(parseGeminiApiErrorStatus('Gemini API error: 429 quota')).toBe(429);
    expect(parseGeminiApiErrorStatus('Gemini API error: 503 busy')).toBe(503);
    expect(parseGeminiApiErrorStatus('network down')).toBeNull();
  });

  it('returns default 5s delay for 429', () => {
    expect(
      geminiRetryDelayMs('Gemini API error: 429 You exceeded your current quota')
    ).toBe(GEMINI_RATE_LIMIT_RETRY_MS);
  });

  it('honors Please retry in Xs from Google', () => {
    expect(
      geminiRetryDelayMs(
        'Gemini API error: 429 quota Please retry in 13.439273151s.'
      )
    ).toBe(13440);
  });

  it('does not retry when prepayment credits are depleted', () => {
    expect(
      geminiRetryDelayMs(
        'Gemini API error: 429 Your prepayment credits are depleted.'
      )
    ).toBeNull();
  });

  it('does not retry non-429 errors', () => {
    expect(
      geminiRetryDelayMs('Gemini API error: 503 This model is currently experiencing high demand.')
    ).toBeNull();
  });
});
