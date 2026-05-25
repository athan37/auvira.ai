import type { LLMProvider } from './types';
import { MiniMaxApiProvider } from './minimaxApiProvider';
import { MiniMaxProxyProvider } from './minimaxProxyProvider';
import { GeminiProvider } from './geminiProvider';

export function getLLMClient(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || 'minimax';

  if (provider === 'minimax' || provider === 'minimax-api') {
    return new MiniMaxApiProvider();
  }

  if (provider === 'minimax-proxy') {
    return new MiniMaxProxyProvider();
  }

  if (provider === 'gemini') {
    return new GeminiProvider();
  }

  return new MiniMaxApiProvider();
}

export { type GenerateJSONInput, type GenerateJSONResult, type LLMProvider } from './types';