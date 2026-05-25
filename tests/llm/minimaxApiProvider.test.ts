import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MiniMaxApiProvider } from '@/lib/llm/minimaxApiProvider';
import { extractJsonText, parseJsonOutput, validateAgainstSchema } from '@/lib/llm/jsonOutputHelpers';

describe('jsonOutputHelpers', () => {
  it('extracts JSON from markdown fences', () => {
    const raw = 'Here you go:\n```json\n{"a":1}\n```';
    expect(extractJsonText(raw)).toBe('{"a":1}');
  });

  it('validates schema', () => {
    const result = validateAgainstSchema(
      { msg: 'hi' },
      {
        type: 'object',
        required: ['msg'],
        properties: { msg: { type: 'string' } },
      }
    );
    expect(result.valid).toBe(true);
  });
});

describe('MiniMaxApiProvider', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('calls Anthropic-compatible messages endpoint and parses JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"msg":"Hello"}' }],
      }),
    });

    const provider = new MiniMaxApiProvider({
      apiKey: 'test-key',
      apiUrl: 'https://api.minimax.io/anthropic/v1/messages',
      model: 'MiniMax-M2.7-highspeed',
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
    expect(result.data.msg).toBe('Hello');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.minimax.io/anthropic/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('test-key');

    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('MiniMax-M2.7-highspeed');
    expect(body.stream).toBe(false);
    expect(body.messages[0].role).toBe('user');
  });

  it('retries when JSON is invalid', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'not json' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '{"msg":"fixed"}' }],
        }),
      });

    const provider = new MiniMaxApiProvider({
      apiKey: 'test-key',
      apiUrl: 'https://api.minimax.io/anthropic/v1/messages',
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
});

describe('parseJsonOutput', () => {
  it('parses plain JSON', () => {
    const r = parseJsonOutput<{ x: number }>('{"x":1}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.x).toBe(1);
  });
});
