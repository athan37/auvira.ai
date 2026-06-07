import type { SyntheticSiteSpec } from './syntheticSiteWorkspace';

/** Site with hero + About Us — mirrors project 6a1f8d hero clarification loss. */
export function heroClarificationReplaySiteSpec(): SyntheticSiteSpec {
  return {
    businessName: 'Clarification Replay Co',
    hero: {
      headline: 'Welcome to Our Business',
      subheadline: 'We help you grow',
      primaryCta: 'Get Started',
    },
    sections: [
      { type: 'services', title: 'Our Services', body: 'What we offer.' },
      { type: 'about', title: 'About Us', body: 'Our story.' },
      { type: 'contact', title: 'Contact Us', body: 'Reach out today.' },
    ],
  };
}

export const HERO_CLARIFICATION_TURN1 = 'improve color of this section (hero section)';

export const HERO_CLARIFICATION_ASSISTANT_COLOR =
  'Which color would you like to improve on the hero section?';

export const HERO_CLARIFICATION_TURN2 = 'Background color';

export const HERO_CLARIFICATION_ASSISTANT_GRADIENT =
  'What background color or gradient would you like for this section? For example, you could say a solid color (like green or blue), a different gradient direction, or a specific shade.';

export const HERO_CLARIFICATION_TURN3 = 'Blue to green gradient';

export function heroClarificationHistoryThroughTurn2() {
  return [
    { role: 'user' as const, content: HERO_CLARIFICATION_TURN1 },
    { role: 'assistant' as const, content: HERO_CLARIFICATION_ASSISTANT_COLOR },
    { role: 'user' as const, content: HERO_CLARIFICATION_TURN2 },
    { role: 'assistant' as const, content: HERO_CLARIFICATION_ASSISTANT_GRADIENT },
  ];
}

export function heroClarificationHistoryThroughTurn3() {
  return [
    ...heroClarificationHistoryThroughTurn2(),
    { role: 'user' as const, content: HERO_CLARIFICATION_TURN3 },
  ];
}
