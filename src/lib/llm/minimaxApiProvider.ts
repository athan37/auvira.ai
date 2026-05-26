import type { LLMProvider, GenerateJSONInput, GenerateJSONResult } from './types';
import { extractJsonText, parseJsonOutput, validateAgainstSchema } from './jsonOutputHelpers';

const DEFAULT_API_URL = 'https://api.minimax.io/anthropic/v1/messages';
const DEFAULT_MODEL = 'MiniMax-M2.7-highspeed';
const MAX_ATTEMPTS = 2;

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking?: string }
  | { type: string; text?: string; thinking?: string };

type AnthropicMessageResponse = {
  content?: AnthropicContentBlock[];
  error?: { message?: string };
};

/**
 * Calls MiniMax Text API (Anthropic-compatible) directly.
 * Replaces the local :3457 proxy; includes JSON parse + schema validation retries.
 */
export class MiniMaxApiProvider implements LLMProvider {
  private apiUrl: string;
  private apiKey: string;
  private model: string;

  constructor(options?: { apiUrl?: string; apiKey?: string; model?: string }) {
    this.apiUrl = options?.apiUrl || process.env.MINIMAX_API_URL || DEFAULT_API_URL;
    this.apiKey = options?.apiKey || process.env.MINIMAX_API_KEY || '';
    this.model = options?.model || process.env.MINIMAX_MODEL || DEFAULT_MODEL;

    if (!this.apiKey) {
      throw new Error('MINIMAX_API_KEY is required when LLM_PROVIDER=minimax');
    }
  }

  async generateJSON<T = unknown>(input: GenerateJSONInput): Promise<GenerateJSONResult<T>> {
    let lastError = 'Unknown error';
    let lastRaw = '';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const repairHint =
        attempt > 1
          ? '\n\nYour previous response was invalid or did not match the schema. Return ONLY valid JSON with no markdown fences or commentary.'
          : '';

      const userText = input.schema
        ? `${input.prompt}${repairHint}\n\nRespond with ONLY valid JSON matching this JSON Schema:\n${JSON.stringify(input.schema)}`
        : `${input.prompt}${repairHint}`;

      let raw: string;
      try {
        raw = await this.callMessagesApi(input.system, userText, {
          maxTokens: input.maxTokens,
          temperature: input.temperature,
        });
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'MiniMax API call failed';
        continue;
      }
      lastRaw = raw;

      const parsed = parseJsonOutput<T>(raw);
      if (!parsed.ok) {
        lastError = parsed.error;
        continue;
      }

      const validation = validateAgainstSchema(parsed.data, input.schema);
      if (!validation.valid) {
        lastError = JSON.stringify(validation.errors);
        continue;
      }

      return {
        ok: true,
        attempt,
        data: parsed.data,
        function_call: null,
        validation: {
          enabled: Boolean(input.schema),
          valid: true,
          errors: [],
        },
      };
    }

    return {
      ok: false,
      attempt: MAX_ATTEMPTS,
      data: (lastRaw ? extractJsonText(lastRaw) : {}) as T,
      function_call: null,
      validation: {
        enabled: Boolean(input.schema),
        valid: false,
        errors: [{ message: lastError }],
      },
    };
  }

  async generateJSONStream<T = unknown>(
    input: GenerateJSONInput,
    onToken?: (token: string) => void
  ): Promise<GenerateJSONResult<T>> {
    // Streaming JSON is not required for owner edits; use non-streaming path.
    void onToken;
    return this.generateJSON<T>(input);
  }

  private async callMessagesApi(
    system: string | undefined,
    userText: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<string> {
    const defaultMax = parseInt(process.env.WEBSITE_EDIT_MAX_TOKENS || '8192', 10);
    const body = {
      model: this.model,
      max_tokens: options?.maxTokens ?? defaultMax,
      stream: false,
      temperature: options?.temperature ?? 1,
      ...(system ? { system } : {}),
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: userText }],
        },
      ],
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as AnthropicMessageResponse & {
      message?: string;
    };

    if (!response.ok) {
      const msg = payload.error?.message || payload.message || response.statusText;
      throw new Error(`MiniMax API error: ${response.status} ${msg}`);
    }

    return this.extractTextFromContent(payload.content ?? []);
  }

  private extractTextFromContent(blocks: AnthropicContentBlock[]): string {
    const parts: string[] = [];
    for (const block of blocks) {
      if (block.type === 'text' && block.text) {
        parts.push(block.text);
      }
    }
    return parts.join('\n').trim();
  }
}
