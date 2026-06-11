import { describe, expect, it } from 'vitest';
import {
  evidenceFromIntentSentence,
  extractColorFromIntentSentence,
  extractColorsFromIntentSentence,
  hasUsableIntentSentence,
  intentSentenceIsUnresolved,
} from '@/lib/observability/intentSentence';

describe('intentSentence', () => {
  it('extracts color from resolved Monitor sentence', () => {
    const sentence =
      "Change the Contact Us section card background (sections[2].presentation.cardClass) to green, the owner's favorite color.";
    expect(extractColorFromIntentSentence(sentence)).toBe('green');
    expect(hasUsableIntentSentence(sentence)).toBe(true);
  });

  it('treats unresolved Monitor sentence as not usable', () => {
    const sentence =
      "Change the Contact Us section background to the owner's favorite color; color not yet known from project history.";
    expect(intentSentenceIsUnresolved(sentence)).toBe(true);
    expect(hasUsableIntentSentence(sentence)).toBe(false);
    expect(evidenceFromIntentSentence(sentence, 'color')).toBeNull();
  });

  it('extracts gradient class and phrase colors', () => {
    const sentence = 'Apply gradient-red to the hero and use gradient blue accents.';
    expect(extractColorsFromIntentSentence(sentence)).toEqual(['red', 'blue']);
    expect(extractColorFromIntentSentence(sentence)).toBe('blue');
  });

  it('extracts quoted copy from Monitor sentence', () => {
    const sentence = 'Change the hero headline (hero.headline) to "Schedule Your Free Consultation".';
    expect(evidenceFromIntentSentence(sentence, 'copy')?.value).toBe(
      'Schedule Your Free Consultation'
    );
  });
});
