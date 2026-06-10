import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLlmClient, getWebsiteEditLLMClient } from '@/lib/llm/llmClient';
import { GeminiProvider } from '@/lib/llm/geminiProvider';
import { MiniMaxApiProvider } from '@/lib/llm/minimaxApiProvider';

describe('llmClient routing', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.GEMINI_API_KEY = 'test-gemini';
    process.env.MINIMAX_API_KEY = 'test-minimax';
  });

  afterEach(() => {
    process.env = env;
  });

  it('createLlmClient selects Gemini', () => {
    expect(createLlmClient('gemini')).toBeInstanceOf(GeminiProvider);
    expect(createLlmClient('google')).toBeInstanceOf(GeminiProvider);
  });

  it('createLlmClient selects MiniMax by default', () => {
    expect(createLlmClient()).toBeInstanceOf(MiniMaxApiProvider);
    expect(createLlmClient('minimax')).toBeInstanceOf(MiniMaxApiProvider);
  });

  it('getWebsiteEditLLMClient defaults to Gemini even when LLM_PROVIDER is minimax', () => {
    delete process.env.WEBSITE_EDIT_LLM_PROVIDER;
    process.env.LLM_PROVIDER = 'minimax';
    expect(getWebsiteEditLLMClient()).toBeInstanceOf(GeminiProvider);
  });

  it('getWebsiteEditLLMClient honors WEBSITE_EDIT_LLM_PROVIDER=minimax', () => {
    process.env.WEBSITE_EDIT_LLM_PROVIDER = 'minimax';
    expect(getWebsiteEditLLMClient()).toBeInstanceOf(MiniMaxApiProvider);
  });
});
