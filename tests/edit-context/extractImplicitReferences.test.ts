import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/llm/llmClient', () => ({
  getLLMClient: vi.fn(),
}));

import { getLLMClient } from '@/lib/llm/llmClient';
import {
  collectImplicitPhrases,
  extractImplicitReferencesFromMessage,
  shouldExtractImplicitRefs,
} from '@/lib/project-workspace/edit-context/extractImplicitReferences';

describe('extractImplicitReferences', () => {
  beforeEach(() => {
    vi.mocked(getLLMClient).mockReset();
  });

  it('gates generic deictic messages', () => {
    expect(shouldExtractImplicitRefs('use my favorite way to edit this section')).toBe(true);
    expect(shouldExtractImplicitRefs('make the contact section background green')).toBe(false);
  });

  it('extracts edit_pattern phrase via LLM', async () => {
    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          references: [
            {
              phrase: 'my favorite way to edit',
              kind: 'edit_pattern',
              scopeHint: 'this_section',
            },
          ],
        },
      }),
    } as ReturnType<typeof getLLMClient>);

    const refs = await extractImplicitReferencesFromMessage(
      'use my favorite way to edit this section'
    );
    expect(refs).toHaveLength(1);
    expect(refs[0]?.kind).toBe('edit_pattern');
    expect(refs[0]?.scopeHint).toBe('this_section');
  });

  it('detects British spelling and common typos for favorite color', async () => {
    for (const message of [
      'change this to my favourite color',
      'change this to my faviourite color',
    ]) {
      const { refs, fromLlm } = await collectImplicitPhrases(message);
      expect(refs.some((r) => r.kind === 'color')).toBe(true);
      expect(fromLlm).toBe(false);
    }
  });

  it('uses regex fast-path without LLM when known phrase matches', async () => {
    const llm = vi.fn();
    vi.mocked(getLLMClient).mockReturnValue({
      generateJSON: llm,
    } as ReturnType<typeof getLLMClient>);

    const { refs, fromLlm } = await collectImplicitPhrases('background my favorite color');
    expect(refs.some((r) => r.phrase.toLowerCase().includes('favorite color'))).toBe(true);
    expect(fromLlm).toBe(false);
    expect(llm).not.toHaveBeenCalled();
  });
});
