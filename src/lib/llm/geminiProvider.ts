import type { LLMProvider, GenerateJSONInput, GenerateJSONResult } from './types';

export class GeminiProvider implements LLMProvider {
  async generateJSON<T = unknown>(input: GenerateJSONInput): Promise<GenerateJSONResult<T>> {
    throw new Error('GeminiProvider not implemented yet');
  }
}