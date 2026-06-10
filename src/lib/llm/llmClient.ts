import type { LLMProvider } from './types';
import { GeminiProvider } from './geminiProvider';

function normalizeProviderName(provider: string | undefined): string {
  return (provider || '').trim().toLowerCase();
}

const SUPPORTED_PROVIDERS = new Set(['gemini', 'google']);

/** Instantiate an LLM provider by name (Gemini only). */
export function createLlmClient(providerName?: string): LLMProvider {
  const provider = normalizeProviderName(providerName) || 'gemini';

  if (SUPPORTED_PROVIDERS.has(provider)) {
    return new GeminiProvider();
  }

  throw new Error(
    `Unsupported LLM_PROVIDER: ${providerName ?? '(unset)'} — only gemini is supported`
  );
}

/** Default LLM client for clone, scratch, edit agent, and legacy agent routes. */
export function getLLMClient(): LLMProvider {
  return createLlmClient(process.env.LLM_PROVIDER);
}

/** @deprecated Use getLLMClient — kept for planner re-exports. */
export function getWebsiteEditLLMClient(): LLMProvider {
  return getLLMClient();
}

export { type GenerateJSONInput, type GenerateJSONResult, type LLMProvider } from './types';
