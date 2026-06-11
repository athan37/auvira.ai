import type { GenerateJSONInput, GenerateJSONResult, LLMProvider } from './types';
import { extractJsonText, parseJsonOutput, validateAgainstSchema } from './jsonOutputHelpers';
import { geminiRetryDelayMs } from './geminiRetryDelay';

const DEFAULT_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-flash-latest';
const MAX_ATTEMPTS = 2;

type GeminiPart = { text?: string };
type GeminiContent = { role?: string; parts?: GeminiPart[] };
type GeminiGenerateResponse = {
  candidates?: Array<{ content?: GeminiContent }>;
  error?: { message?: string; status?: string };
};

/**
 * Google Generative Language API (Gemini) for structured JSON generation.
 * Uses `generateContent` with `X-goog-api-key` auth.
 */
export class GeminiProvider implements LLMProvider {
  private apiBase: string;
  private apiKey: string;
  private model: string;

  constructor(options?: { apiBase?: string; apiKey?: string; model?: string }) {
    this.apiBase = (options?.apiBase || process.env.GEMINI_API_URL || DEFAULT_API_BASE).replace(
      /\/$/,
      ''
    );
    this.apiKey =
      options?.apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      '';
    this.model = options?.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;

    if (!this.apiKey) {
      throw new Error(
        'GEMINI_API_KEY (or GOOGLE_API_KEY) is required when LLM_PROVIDER=gemini'
      );
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
        raw = await this.callGenerateContent(input.system, userText, {
          maxTokens: input.maxTokens,
          temperature: input.temperature,
          schema: input.schema,
        });
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Gemini API call failed';
        if (attempt < MAX_ATTEMPTS) {
          const delayMs = geminiRetryDelayMs(lastError);
          if (delayMs != null) {
            await sleep(delayMs);
          }
        }
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
    void onToken;
    return this.generateJSON<T>(input);
  }

  private endpointUrl(): string {
    return `${this.apiBase}/models/${encodeURIComponent(this.model)}:generateContent`;
  }

  private async callGenerateContent(
    system: string | undefined,
    userText: string,
    options?: { maxTokens?: number; temperature?: number; schema?: object }
  ): Promise<string> {
    const defaultMax = parseInt(process.env.WEBSITE_EDIT_MAX_TOKENS || '8192', 10);
    const generationConfig: Record<string, unknown> = {
      temperature: options?.temperature ?? 0,
      maxOutputTokens: options?.maxTokens ?? defaultMax,
    };
    if (options?.schema) {
      generationConfig.responseMimeType = 'application/json';
    }

    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig,
    };
    if (system?.trim()) {
      body.systemInstruction = { parts: [{ text: system.trim() }] };
    }

    const response = await fetch(this.endpointUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as GeminiGenerateResponse;

    if (!response.ok) {
      const msg = payload.error?.message || response.statusText;
      throw new Error(`Gemini API error: ${response.status} ${msg}`);
    }

    return this.extractTextFromCandidates(payload.candidates ?? []);
  }

  private extractTextFromCandidates(
    candidates: GeminiGenerateResponse['candidates']
  ): string {
    const parts: string[] = [];
    for (const candidate of candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.text?.trim()) parts.push(part.text.trim());
      }
    }
    return parts.join('\n').trim();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
