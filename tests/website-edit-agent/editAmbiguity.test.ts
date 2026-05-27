import { describe, it, expect } from 'vitest';
import {
  detectAmbiguousEditRequest,
  detectScopedStyleRequest,
  resolveEffectiveEditMessage,
  tryResolveScopedStyleFromHistory,
  formatConversationForPrompt,
} from '../../src/lib/project-workspace/website-edit-agent/editAmbiguity';

describe('editAmbiguity', () => {
  const examplePrompt =
    'change the card below to red in the section what our customers say to red';

  it('detects scoped style request for card+section+color', () => {
    expect(detectScopedStyleRequest(examplePrompt)).toBe(true);
  });

  it('flags card+section+color as ambiguous', () => {
    const result = detectAmbiguousEditRequest(examplePrompt);
    expect(result.ambiguous).toBe(true);
    expect(result.clarificationMessage).toMatch(/What Our Customers Say|testimonial/i);
    expect(result.suggestedReplies?.length).toBe(3);
  });

  it('detects deictic "below" as ambiguous with scoped style', () => {
    const result = detectAmbiguousEditRequest('change the card below to blue in testimonials');
    expect(result.ambiguous).toBe(true);
  });

  it('resolves follow-up "1" when history contains clarification', () => {
    const history = [
      { role: 'user' as const, content: examplePrompt },
      {
        role: 'assistant' as const,
        content: 'Reply with 1, 2, or 3 — testimonial cards clarification.',
      },
    ];
    const result = detectAmbiguousEditRequest('1', history);
    expect(result.ambiguous).toBe(false);
    expect(result.confidence).toBe('high');
  });

  it('resolveEffectiveEditMessage expands "1" with prior color', () => {
    const history = [
      { role: 'user' as const, content: examplePrompt },
      { role: 'assistant' as const, content: 'Reply with 1, 2, or 3' },
    ];
    const effective = resolveEffectiveEditMessage('1', history);
    expect(effective).toMatch(/testimonial card backgrounds/i);
    expect(effective).toMatch(/red/i);
  });

  it('tryResolveScopedStyleFromHistory maps option 1 to allTestimonialCards', () => {
    const history = [
      { role: 'user' as const, content: examplePrompt },
      { role: 'assistant' as const, content: 'Reply with 1, 2, or 3' },
    ];
    const resolved = tryResolveScopedStyleFromHistory('1', history);
    expect(resolved.resolved).toBe(true);
    expect(resolved.scope).toBe('allTestimonialCards');
    expect(resolved.targetColor).toBe('red');
  });

  it('formatConversationForPrompt includes recent turns', () => {
    const block = formatConversationForPrompt([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ]);
    expect(block).toContain('RECENT CONVERSATION');
    expect(block).toContain('User: hello');
    expect(block).toContain('Assistant: hi there');
  });
});
