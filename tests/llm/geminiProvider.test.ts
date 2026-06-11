import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider } from '@/lib/llm/geminiProvider';
import { GEMINI_RATE_LIMIT_RETRY_MS } from '@/lib/llm/geminiRetryDelay';

describe('GeminiProvider', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('calls generateContent with X-goog-api-key and parses JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"msg":"Hello"}' }] } }],
      }),
    });

    const provider = new GeminiProvider({
      apiKey: 'test-gemini-key',
      apiBase: 'https://generativelanguage.googleapis.com/v1beta',
      model: 'gemini-flash-latest',
    });

    const result = await provider.generateJSON<{ msg: string }>({
      system: 'You are a test assistant.',
      prompt: 'say hi',
      schema: {
        type: 'object',
        required: ['msg'],
        properties: { msg: { type: 'string' } },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data.msg).toBe('Hello');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent'
    );
    expect((init.headers as Record<string, string>)['X-goog-api-key']).toBe('test-gemini-key');

    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts[0].text).toContain('say hi');
    expect(body.systemInstruction.parts[0].text).toBe('You are a test assistant.');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('retries when JSON is invalid', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'not json' }] } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"msg":"fixed"}' }] } }],
        }),
      });

    const provider = new GeminiProvider({
      apiKey: 'test-gemini-key',
      apiBase: 'https://generativelanguage.googleapis.com/v1beta',
    });

    const result = await provider.generateJSON<{ msg: string }>({
      prompt: 'say hi',
      schema: {
        type: 'object',
        required: ['msg'],
        properties: { msg: { type: 'string' } },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.attempt).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('waits ~5s then retries on 429 rate limit', async () => {
    vi.useFakeTimers();

    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          error: { message: 'quota exceeded' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"msg":"ok"}' }] } }],
        }),
      });

    const provider = new GeminiProvider({
      apiKey: 'test-gemini-key',
      apiBase: 'https://generativelanguage.googleapis.com/v1beta',
    });

    const resultPromise = provider.generateJSON<{ msg: string }>({
      prompt: 'say hi',
      schema: {
        type: 'object',
        required: ['msg'],
        properties: { msg: { type: 'string' } },
      },
    });

    await vi.advanceTimersByTimeAsync(GEMINI_RATE_LIMIT_RETRY_MS);
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    expect(result.attempt).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('throws when API key is missing', () => {
    const savedGemini = process.env.GEMINI_API_KEY;
    const savedGoogle = process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    try {
      expect(() => new GeminiProvider({ apiKey: '' })).toThrow(/GEMINI_API_KEY/);
    } finally {
      if (savedGemini !== undefined) process.env.GEMINI_API_KEY = savedGemini;
      else delete process.env.GEMINI_API_KEY;
      if (savedGoogle !== undefined) process.env.GOOGLE_API_KEY = savedGoogle;
      else delete process.env.GOOGLE_API_KEY;
    }
  });
});
