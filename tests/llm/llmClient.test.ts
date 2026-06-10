import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLlmClient, getLLMClient, getWebsiteEditLLMClient } from '@/lib/llm/llmClient';
import { GeminiProvider } from '@/lib/llm/geminiProvider';

describe('llmClient routing', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.GEMINI_API_KEY = 'test-gemini';
  });

  afterEach(() => {
    process.env = env;
  });

  it('createLlmClient selects Gemini by default', () => {
    expect(createLlmClient()).toBeInstanceOf(GeminiProvider);
    expect(createLlmClient('gemini')).toBeInstanceOf(GeminiProvider);
    expect(createLlmClient('google')).toBeInstanceOf(GeminiProvider);
  });

  it('createLlmClient throws for unsupported providers', () => {
    expect(() => createLlmClient('minimax')).toThrow(/only gemini is supported/i);
    expect(() => createLlmClient('openai')).toThrow(/only gemini is supported/i);
  });

  it('getLLMClient uses LLM_PROVIDER when set', () => {
    process.env.LLM_PROVIDER = 'google';
    expect(getLLMClient()).toBeInstanceOf(GeminiProvider);
  });

  it('getWebsiteEditLLMClient aliases getLLMClient', () => {
    process.env.LLM_PROVIDER = 'gemini';
    expect(getWebsiteEditLLMClient()).toBeInstanceOf(GeminiProvider);
  });
});
