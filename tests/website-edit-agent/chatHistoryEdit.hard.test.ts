import { describe, expect, it } from 'vitest';
import { classifyEditJob } from '@/lib/project-workspace/website-edit-agent/editJobClassifier';
import {
  resolveEffectiveEditMessage,
  detectAmbiguousEditRequest,
} from '@/lib/project-workspace/website-edit-agent/editAmbiguity';
import type { ConversationTurn } from '@/lib/project-workspace/website-edit-agent/types';

const SECTION_LIST_CLARIFICATION =
  'Which section should I change? Reply with the number:\n\n' +
  '1. [0] services — "Services"\n' +
  '2. [1] about — "About Us"\n' +
  '3. [2] gallery — "Hello"\n' +
  '4. [3] testimonials — "What Our Customers Say"';

const STYLE_SCOPE_CLARIFICATION =
  'This sounds like a color or style change, not new section content — can you confirm what you want to restyle (e.g. card backgrounds, text color, or the whole section background)?';

const TESTIMONIAL_CARD_CLARIFICATION =
  'I can change something in "What Our Customers Say" to red, but I need one detail:\n\n' +
  '1. Background of **all** testimonial cards\n' +
  '2. Background of **one** card (paste the customer name or quote)\n' +
  '3. **Text** color in that section\n\n' +
  'Reply with 1, 2, or 3 — or describe exactly which card and whether you mean background or text.';

function history(...turns: ConversationTurn[]): ConversationTurn[] {
  return turns;
}

describe('chat history intent clarifier (hard deterministic cases)', () => {
  it('merges section number follow-up with prior deictic color request', () => {
    const turns = history(
      { role: 'user', content: 'Change the background color of this to red' },
      { role: 'assistant', content: SECTION_LIST_CLARIFICATION }
    );
    const effective = resolveEffectiveEditMessage('3', turns);
    expect(effective).toMatch(/red/i);
    expect(effective).toMatch(/target section index 2/i);

    const plan = classifyEditJob('3', [], null, turns);
    expect(plan.needsClarification).not.toBe(true);
    expect(plan.primaryStrategy).not.toBe('agent_loop');
  });

  it('merges style-scope follow-up with prior gallery request', () => {
    const turns = history(
      { role: 'user', content: 'Change the gallery section to red' },
      { role: 'assistant', content: STYLE_SCOPE_CLARIFICATION }
    );
    const effective = resolveEffectiveEditMessage('whole section background', turns);
    expect(effective).toMatch(/gallery/i);
    expect(effective).toMatch(/whole section background/i);

    const ambiguity = detectAmbiguousEditRequest('whole section background', turns);
    expect(ambiguity.ambiguous).toBe(false);
  });

  it('resolves testimonial card option "1" using prior color from history', () => {
    const turns = history(
      {
        role: 'user',
        content: 'change the card below to red in the section what our customers say to red',
      },
      { role: 'assistant', content: TESTIMONIAL_CARD_CLARIFICATION }
    );
    const effective = resolveEffectiveEditMessage('1', turns);
    expect(effective).toMatch(/testimonial card backgrounds/i);
    expect(effective).toMatch(/red/i);

    const ambiguity = detectAmbiguousEditRequest('1', turns);
    expect(ambiguity.ambiguous).toBe(false);
  });

  it('uses prior section title when follow-up is deictic "this section"', () => {
    const turns = history({
      role: 'user',
      content: 'Change the background color of this to red: Everything You Need to Grow Your Business',
    });
    const ambiguity = detectAmbiguousEditRequest('make this section darker', turns);
    expect(ambiguity.ambiguous).toBe(false);
  });
});
