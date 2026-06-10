import type { LLMProvider } from './types';
import { MiniMaxApiProvider } from './minimaxApiProvider';
import { MiniMaxProxyProvider } from './minimaxProxyProvider';
import { GeminiProvider } from './geminiProvider';

function normalizeProviderName(provider: string | undefined): string {
  return (provider || '').trim().toLowerCase();
}

/** Instantiate an LLM provider by name. */
export function createLlmClient(providerName?: string): LLMProvider {
  const provider = normalizeProviderName(providerName) || 'minimax';

  if (provider === 'minimax' || provider === 'minimax-api') {
    return new MiniMaxApiProvider();
  }

  if (provider === 'minimax-proxy') {
    return new MiniMaxProxyProvider();
  }

  if (provider === 'gemini' || provider === 'google') {
    return new GeminiProvider();
  }

  return new MiniMaxApiProvider();
}

/** Default LLM client (clone, scratch, legacy agent routes). */
export function getLLMClient(): LLMProvider {
  return createLlmClient(process.env.LLM_PROVIDER);
}

/** Website edit agent + planner — defaults to Gemini (independent of `LLM_PROVIDER`). */
export function getWebsiteEditLLMClient(): LLMProvider {
  const provider = process.env.WEBSITE_EDIT_LLM_PROVIDER || 'gemini';
  return createLlmClient(provider);
}

export { type GenerateJSONInput, type GenerateJSONResult, type LLMProvider } from './types';
