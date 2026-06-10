import { describe, expect, it } from 'vitest';
import { requireGenerateJsonResult } from '@/lib/llm/requireGenerateJsonResult';

describe('requireGenerateJsonResult', () => {
  it('returns data when the LLM call succeeded', () => {
    const data = requireGenerateJsonResult(
      { ok: true, data: { businessName: 'Acme' } },
      'Factual data extraction'
    );
    expect(data).toEqual({ businessName: 'Acme' });
  });

  it('throws a readable error when the LLM call failed', () => {
    expect(() =>
      requireGenerateJsonResult(
        {
          ok: false,
          data: {},
          validation: {
            enabled: true,
            valid: false,
            errors: [{ message: 'Gemini API error: 429 Resource exhausted' }],
          },
        },
        'Factual data extraction'
      )
    ).toThrow(/Factual data extraction failed: Gemini API error: 429/);
  });
});
