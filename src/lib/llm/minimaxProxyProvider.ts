import type { LLMProvider, GenerateJSONInput, GenerateJSONResult } from './types';

export class MiniMaxProxyProvider implements LLMProvider {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.MINIMAX_PROXY_URL || 'http://localhost:3457/minimax-json';
  }

  async generateJSON<T = unknown>(input: GenerateJSONInput): Promise<GenerateJSONResult<T>> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: input.prompt,
        schema: input.schema,
        system: input.system,
        functions: input.functions,
      }),
    });

    if (!response.ok) {
      throw new Error(`MiniMax proxy error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.ok && result.validation?.valid === false) {
      throw new Error(`Schema validation failed: ${JSON.stringify(result.validation.errors)}`);
    }

    return result as GenerateJSONResult<T>;
  }

  async generateJSONStream<T = unknown>(
    input: GenerateJSONInput,
    onToken?: (token: string) => void
  ): Promise<GenerateJSONResult<T>> {
    const streamUrl = this.baseUrl.replace('/minimax-json', '/minimax-json/stream');

    let response: Response;
    try {
      response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: input.prompt,
          schema: input.schema,
          system: input.system,
          functions: input.functions,
        }),
      });
    } catch {
      // Network error or stream endpoint unavailable - fall back to non-streaming
      return this.generateJSON<T>(input);
    }

    if (!response.ok) {
      // Non-2xx response - fall back to non-streaming
      return this.generateJSON<T>(input);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream') && !contentType.includes('stream')) {
      // Endpoint doesn't return SSE - fall back to non-streaming
      return this.generateJSON<T>(input);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;

        let event: { token?: string; done?: boolean; error?: string };
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }

        if (event.error) {
          throw new Error(`Stream error: ${event.error}`);
        }

        if (event.token) {
          buffer += event.token;
          onToken?.(event.token);
        }

        if (event.done) {
          break;
        }
      }
      if (buffer.endsWith('}"')) break;
    }

    // Validate the buffer looks like JSON before parsing
    const trimmed = buffer.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      // Buffer doesn't look like JSON - stream may have returned HTML or error page
      // Fall back to non-streaming
      return this.generateJSON<T>(input);
    }

    // Parse and validate the complete response
    let result: GenerateJSONResult<T>;
    try {
      result = JSON.parse(buffer);
    } catch {
      // Buffer looked like JSON start but failed to parse - stream may have been interrupted
      // Fall back to non-streaming
      return this.generateJSON<T>(input);
    }

    if (!result.ok && result.validation?.valid === false) {
      throw new Error(`Schema validation failed: ${JSON.stringify(result.validation.errors)}`);
    }

    return result as GenerateJSONResult<T>;
  }
}