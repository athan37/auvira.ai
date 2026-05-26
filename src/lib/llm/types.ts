export interface GenerateJSONInput {
  system?: string;
  prompt: string;
  schema?: object;
  functions?: object[];
  /** Override default max_tokens for this call (e.g. website edits). */
  maxTokens?: number;
  /** Override default temperature (0–1). */
  temperature?: number;
}

export interface GenerateJSONResult<T = unknown> {
  ok: boolean;
  attempt?: number;
  data: T;
  function_call?: {
    name: string;
    arguments: string;
  } | null;
  validation?: {
    enabled: boolean;
    valid: boolean;
    errors: unknown[];
  };
}

export interface LLMProvider {
  generateJSON<T = unknown>(input: GenerateJSONInput): Promise<GenerateJSONResult<T>>;
  generateJSONStream?<T = unknown>(
    input: GenerateJSONInput,
    onToken?: (token: string) => void
  ): Promise<GenerateJSONResult<T>>;
}