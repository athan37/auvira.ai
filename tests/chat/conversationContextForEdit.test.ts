import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDIT_CONTEXT_TURNS,
  extractSectionPickFromListReply,
  extractSectionTitleFromListReply,
  formatConversationForIntentClarifier,
  formatWeightedConversationForPrompt,
  resolveEffectiveEditMessage,
} from '../../src/lib/chat/conversationContextForEdit';

describe('conversationContextForEdit', () => {
  it('weights closest turns with more stars in prompt output', () => {
    const block = formatWeightedConversationForPrompt([
      { role: 'user', content: 'older request' },
      { role: 'assistant', content: 'Which section?' },
      { role: 'user', content: 'latest request' },
    ]);

    expect(block).toContain('CONVERSATION CONTEXT (recency-weighted');
    expect(block).toContain('★★★ User [CURRENT — highest weight]: latest request');
    expect(block).toContain('★★ Assistant [high recency]: Which section?');
    expect(block).toContain('★ User: older request');
  });

  it('merges section number reply with prior user intent', () => {
    const history = [
      { role: 'user' as const, content: 'change background to red' },
      {
        role: 'assistant' as const,
        content:
          'Which section should I change? Reply with the number:\n\n1. [0] gallery — "Our Work"\n2. [1] services — "Grow"',
      },
    ];

    const effective = resolveEffectiveEditMessage('1', history);
    expect(effective).toContain('change background to red');
    expect(effective).toContain('Our Work');
    expect(effective).toMatch(/section index: 0|section index 0/i);
  });

  it('merges style clarification follow-up with prior request', () => {
    const history = [
      { role: 'user' as const, content: 'change this section to red: Our Work' },
      {
        role: 'assistant' as const,
        content:
          'can you confirm what you want to restyle (e.g. card backgrounds, text color, or the whole section background)?',
      },
    ];

    const effective = resolveEffectiveEditMessage('whole section background', history);
    expect(effective).toContain('change this section to red');
    expect(effective).toContain('whole section background');
  });

  it('includes resolved request block in intent clarifier format', () => {
    const block = formatConversationForIntentClarifier('1', [
      { role: 'user', content: 'make gallery background blue' },
      {
        role: 'assistant',
        content: 'Which section should I change? Reply with the number:\n\n1. [0] gallery — "Our Work"',
      },
    ]);

    expect(block).toContain('RESOLVED REQUEST');
    expect(block).toContain('gallery background blue');
    expect(block).toContain('Our Work');
  });

  it('extractSectionPickFromListReply returns bracket index and title', () => {
    const assistant =
      'Which section should I change? Reply with the number:\n\n3. [2] gallery — "Hello"';
    expect(extractSectionTitleFromListReply(assistant, 3)).toBe('Hello');
    const pick = extractSectionPickFromListReply(assistant, 3);
    expect(pick?.sectionIndex).toBe(2);
    expect(pick?.title).toBe('Hello');
  });

  it('merges section number reply after a wrong confirmation still uses the numbered list', () => {
    const catalogList =
      'Which section do you mean? Reply with the number:\n\n' +
      '1. [0] services — "Everything You Need to Grow Your Business"\n' +
      '5. [4] contact — "Get Started Today"';
    const history = [
      { role: 'user' as const, content: 'Change the background color of this section to orange' },
      { role: 'assistant' as const, content: catalogList },
      { role: 'user' as const, content: '5' },
      { role: 'assistant' as const, content: 'Updated "Get Started Today" background to orange.' },
    ];

    const effective = resolveEffectiveEditMessage('1', history);
    expect(effective).toContain('orange');
    expect(effective).toContain('Everything You Need to Grow Your Business');
    expect(effective).toContain('section index 0');
  });

  it('uses eight turns by default for edit context', () => {
    expect(DEFAULT_EDIT_CONTEXT_TURNS).toBe(8);
  });
});
