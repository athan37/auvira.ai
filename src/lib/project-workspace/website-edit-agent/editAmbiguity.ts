import {
  extractColorsFromMessage,
} from './preset/presetUtils';
import type { EditTargetPlan } from './types';
import {
  DEFAULT_EDIT_CONTEXT_TURNS,
  formatWeightedConversationForPrompt,
  wasSectionListClarificationAsked,
  wasTestimonialCardClarificationAsked,
} from '@/lib/chat/conversationContextForEdit';

export {
  resolveEffectiveEditMessage,
  formatWeightedConversationForPrompt,
  formatConversationForIntentClarifier,
  DEFAULT_EDIT_CONTEXT_TURNS,
} from '@/lib/chat/conversationContextForEdit';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** @deprecated Use ConversationTurn */
export type ConversationMessage = ConversationTurn;

export interface AmbiguityResult {
  ambiguous: boolean;
  confidence: 'high' | 'medium' | 'low';
  clarificationMessage?: string;
  suggestedReplies?: string[];
}

export type ScopedStyleResolution = {
  resolved: boolean;
  scope?: 'allTestimonialCards' | 'oneTestimonialCard' | 'sectionTextColor';
  targetColor?: string;
};

const STYLING_NOUNS = ['card', 'button', 'background', 'border'];
const CONTENT_ADD_VERBS = [
  'add',
  'remove',
  'delete',
  'faq',
  'questions',
  'items',
  'append',
  'insert',
];
const SECTION_ANCHORS = [
  'section',
  'testimonial',
  'testimonials',
  'customers say',
  'reviews',
  'quotes',
];
const DEICTIC_WORDS = ['below', 'above', 'that', 'this', 'those', 'these'];

function messageHasKeyword(message: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(message);
}

/** True when the message targets styling inside a section, not section content edits. */
export function detectScopedStyleRequest(message: string): boolean {
  const lower = message.toLowerCase();
  const hasColor =
    extractColorsFromMessage(message).length > 0 ||
    /\b(color|colour)\b/.test(lower);
  if (!hasColor) return false;

  const hasStylingNoun = STYLING_NOUNS.some((n) => messageHasKeyword(lower, n));
  if (!hasStylingNoun) return false;

  const hasSectionAnchor =
    SECTION_ANCHORS.some((a) => lower.includes(a)) ||
    /["'][^"']{3,60}["']/.test(message) ||
    /:\s*[^:\n]{3,60}\s*$/.test(message) ||
    /\bwhat our customers say\b/.test(lower);
  if (!hasSectionAnchor) return false;

  const hasContentAdd = CONTENT_ADD_VERBS.some((v) => messageHasKeyword(lower, v));
  if (hasContentAdd) return false;

  return true;
}

function extractSectionTitle(message: string): string | null {
  const quoted = message.match(/["']([^"']{3,60})["']/);
  if (quoted?.[1]) return quoted[1].trim();

  const colon = message.match(/:\s*([^:\n]{3,60})\s*$/);
  if (colon?.[1]) return colon[1].trim();

  if (/\bwhat our customers say\b/i.test(message)) return 'What Our Customers Say';
  if (/\btestimonial/i.test(message)) return 'testimonials';

  const sectionMatch = message.match(/\bsection\s+(.+?)(?:\s+to\s+\w+\s*$|\s*$)/i);
  if (sectionMatch?.[1]) {
    return sectionMatch[1].replace(/\s+to\s+\w+\s*$/i, '').trim();
  }

  return null;
}

function buildCardSectionClarification(sectionTitle: string): AmbiguityResult {
  return {
    ambiguous: true,
    confidence: 'medium',
    clarificationMessage:
      `I can change something in "${sectionTitle}" to red, but I need one detail:\n\n` +
      '1. Background of **all** testimonial cards\n' +
      '2. Background of **one** card (paste the customer name or quote)\n' +
      '3. **Text** color in that section\n\n' +
      'Reply with 1, 2, or 3 — or describe exactly which card and whether you mean background or text.',
    suggestedReplies: [
      '1 — all testimonial card backgrounds',
      '2 — one specific card',
      '3 — text color in that section',
    ],
  };
}

function wasClarificationAsked(history: ConversationTurn[]): boolean {
  return wasTestimonialCardClarificationAsked(history);
}

function resolveClarificationReply(
  message: string,
  history: ConversationTurn[]
): AmbiguityResult | null {
  if (!wasClarificationAsked(history)) return null;

  const lower = message.trim().toLowerCase();
  const isOption =
    /^1\b|all testimonial|all card backgrounds?/i.test(lower) ||
    /^2\b|one specific/i.test(lower) ||
    /^3\b|text color/i.test(lower);

  if (isOption) {
    return { ambiguous: false, confidence: 'high' };
  }

  return null;
}

function resolveSectionListReply(
  message: string,
  history: ConversationTurn[]
): AmbiguityResult | null {
  if (!wasSectionListClarificationAsked(history)) return null;
  if (!/^\d\s*(?:—|$|\b)/.test(message.trim())) return null;
  return { ambiguous: false, confidence: 'high' };
}

/**
 * Detect ambiguous edit requests that need owner clarification before applying changes.
 */
export function detectAmbiguousEditRequest(
  message: string,
  history: ConversationTurn[] = [],
  editTargetPlan?: EditTargetPlan
): AmbiguityResult {
  if (
    editTargetPlan?.where.confidence === 'low' &&
    editTargetPlan.where.clarificationMessage
  ) {
    return {
      ambiguous: true,
      confidence: 'low',
      clarificationMessage: editTargetPlan.where.clarificationMessage,
      suggestedReplies: editTargetPlan.where.suggestedReplies,
    };
  }

  if (
    editTargetPlan?.what === 'copy' &&
    editTargetPlan.where.kind === 'section' &&
    !editTargetPlan.valueExplicit
  ) {
    return {
      ambiguous: true,
      confidence: 'medium',
      clarificationMessage: 'What should the new text be? Paste the exact wording you want.',
    };
  }

  const recent = history.slice(-DEFAULT_EDIT_CONTEXT_TURNS);

  const resolved =
    resolveClarificationReply(message, recent) ??
    resolveSectionListReply(message, recent);
  if (resolved) return resolved;

  const lower = message.toLowerCase();
  const sectionTitle = extractSectionTitle(message);
  const hasDeictic = DEICTIC_WORDS.some((w) => messageHasKeyword(lower, w));
  const hasColor = extractColorsFromMessage(message).length > 0;
  const hasCard = messageHasKeyword(lower, 'card');
  const hasSection = SECTION_ANCHORS.some((a) => lower.includes(a)) || Boolean(sectionTitle);

  if (hasDeictic && /\b(background|color|colour)\b/.test(lower) && !sectionTitle) {
    const priorUser = [...recent]
      .reverse()
      .find((m) => m.role === 'user' && m.content.trim() !== message.trim());
    const priorSection = priorUser ? extractSectionTitle(priorUser.content) : null;
    if (priorSection) {
      return detectAmbiguousEditRequest(
        `${priorUser!.content}. ${message}`,
        history.slice(0, Math.max(0, history.length - 1)),
        editTargetPlan
      );
    }
    return {
      ambiguous: true,
      confidence: 'low',
      clarificationMessage:
        'Which section do you mean? Reply with the section title in quotes, or say "first section" / "second section".',
      suggestedReplies: ['First section', 'Second section', 'Use section title in quotes'],
    };
  }

  if (
    hasDeictic &&
    sectionTitle &&
    /\bbackground\b/.test(lower) &&
    !hasCard &&
    !messageHasKeyword(lower, 'text')
  ) {
    return { ambiguous: false, confidence: 'high' };
  }

  if (hasColor && hasCard && hasSection && detectScopedStyleRequest(message)) {
    const sectionTitle = extractSectionTitle(message) || 'that section';
    return buildCardSectionClarification(sectionTitle);
  }

  if (hasDeictic && detectScopedStyleRequest(message)) {
    if (hasCard && sectionTitle) {
      return buildCardSectionClarification(sectionTitle);
    }
    if (hasCard) {
      return buildCardSectionClarification(sectionTitle || 'that section');
    }
  }

  if (detectScopedStyleRequest(message) && messageHasKeyword(lower, 'section')) {
    return {
      ambiguous: true,
      confidence: 'medium',
      clarificationMessage:
        'This sounds like a color or style change, not new section content — can you confirm what you want to restyle (e.g. card backgrounds, text color, or the whole section background)?',
      suggestedReplies: [
        'Card backgrounds in that section',
        'Text color in that section',
        'Whole section background',
      ],
    };
  }

  const hasColorOnly =
    hasColor &&
    !messageHasKeyword(lower, 'hero') &&
    !messageHasKeyword(lower, 'background') &&
    !messageHasKeyword(lower, 'headline') &&
    !hasCard;

  if (hasColorOnly && messageHasKeyword(lower, 'section')) {
    return {
      ambiguous: true,
      confidence: 'low',
      clarificationMessage:
        'Which part should change color? You can pick site-wide background, hero, section title text, or cards in a specific section.',
      suggestedReplies: [
        'Site-wide background',
        'Hero section',
        'Section title text',
        'Cards in a section',
      ],
    };
  }

  return { ambiguous: false, confidence: 'high' };
}

/** Resolve scoped style intent from clarification follow-ups in chat history. */
export function tryResolveScopedStyleFromHistory(
  message: string,
  history: ConversationTurn[]
): ScopedStyleResolution {
  const recent = history.slice(-DEFAULT_EDIT_CONTEXT_TURNS);
  if (!wasClarificationAsked(recent)) {
    return { resolved: false };
  }

  const lower = message.trim().toLowerCase();
  let targetColor: string | undefined;

  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].role === 'user') {
      const colors = extractColorsFromMessage(recent[i].content);
      if (colors.length > 0) {
        targetColor = colors[colors.length - 1];
        break;
      }
    }
  }

  if (/^1\b|all testimonial|all card backgrounds?/i.test(lower)) {
    return { resolved: true, scope: 'allTestimonialCards', targetColor };
  }
  if (/^2\b|one specific/i.test(lower)) {
    return { resolved: true, scope: 'oneTestimonialCard', targetColor };
  }
  if (/^3\b|text color/i.test(lower)) {
    return { resolved: true, scope: 'sectionTextColor', targetColor };
  }

  return { resolved: false };
}

/** True when the owner wants testimonial/card color styling (resolved or explicit). */
export function isTestimonialsCardColorRequest(message: string): boolean {
  const lower = message.toLowerCase();
  const hasColor = extractColorsFromMessage(message).length > 0;
  if (!hasColor) return false;

  return (
    (/\btestimonial|\bcustomers say|\bcard\b/.test(lower) || /\ball testimonial\b/.test(lower)) &&
    (/\bcard\b/.test(lower) || /\ball testimonial\b/.test(lower) || /^1\b/.test(message.trim()))
  );
}

export function isTestimonialsTextColorRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    extractColorsFromMessage(message).length > 0 &&
    (/\btestimonial|\bcustomers say\b/.test(lower) || /\btext color\b/.test(lower)) &&
    (/\btext\b/.test(lower) || /^3\b/.test(message.trim()))
  );
}

/** Format recent chat for LLM / agent prompts (recency-weighted). */
export function formatConversationForPrompt(
  history: ConversationTurn[] | undefined,
  maxTurns = DEFAULT_EDIT_CONTEXT_TURNS
): string {
  return formatWeightedConversationForPrompt(history, maxTurns);
}
