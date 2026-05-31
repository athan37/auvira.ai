import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/editAmbiguity';
import {
  extractColorsFromMessage,
} from '@/lib/project-workspace/edit-shared/preset/presetUtils';

export const DEFAULT_EDIT_CONTEXT_TURNS = 8;

const STYLE_FOLLOW_UP_PHRASES = [
  'card backgrounds in that section',
  'text color in that section',
  'whole section background',
] as const;

/** Recency stars for prompt formatting — closest turns get more visual weight. */
export function recencyStars(turnsFromEnd: number): string {
  if (turnsFromEnd <= 0) return '★★★';
  if (turnsFromEnd === 1) return '★★';
  if (turnsFromEnd === 2) return '★';
  return '·';
}

/** True when assistant recently asked the owner to pick from numbered options. */
export function wasAssistantClarificationAsked(history: ConversationTurn[]): boolean {
  return history.some(
    (m) =>
      m.role === 'assistant' &&
      (/Reply with 1, 2, or 3/i.test(m.content) ||
        /Reply with the number/i.test(m.content) ||
        /Which section should I change/i.test(m.content) ||
        /can you confirm what you want to restyle/i.test(m.content))
  );
}

export function wasTestimonialCardClarificationAsked(history: ConversationTurn[]): boolean {
  return history.some(
    (m) =>
      m.role === 'assistant' &&
      /testimonial cards|Reply with 1, 2, or 3/i.test(m.content)
  );
}

export function wasSectionListClarificationAsked(history: ConversationTurn[]): boolean {
  return history.some(
    (m) =>
      m.role === 'assistant' &&
      (/Which section should I change\? Reply with the number/i.test(m.content) ||
        /Which section do you mean\? Reply with the number/i.test(m.content) ||
        /Which section should I update/i.test(m.content) ||
        /I found .* sections that could match|Reply with the number/i.test(m.content))
  );
}

function findPriorUserMessage(
  history: ConversationTurn[],
  excludeContent?: string
): ConversationTurn | null {
  const exclude = excludeContent?.trim();
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn.role !== 'user') continue;
    const content = turn.content.trim();
    if (exclude && content === exclude) continue;
    if (content.length >= 4) return turn;
  }
  return null;
}

function lastAssistantTurn(history: ConversationTurn[]): ConversationTurn | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') return history[i];
  }
  return null;
}

/** Most recent assistant turn that listed numbered sections (not a confirmation after a wrong pick). */
export function lastSectionListAssistantTurn(history: ConversationTurn[]): ConversationTurn | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn.role !== 'assistant') continue;
    if (/Reply with the number/i.test(turn.content) && /\b\d+\.\s*\[\d+\]/m.test(turn.content)) {
      return turn;
    }
  }
  return null;
}

/** Parse `"Title"` and `[index]` from assistant section list lines like `3. [2] gallery — "Hello"`. */
export function extractSectionTitleFromListReply(
  assistantContent: string,
  pick: number
): string | null {
  return extractSectionPickFromListReply(assistantContent, pick)?.title ?? null;
}

export function extractSectionPickFromListReply(
  assistantContent: string,
  pick: number
): { title: string; sectionIndex: number } | null {
  for (const line of assistantContent.split('\n')) {
    const quoted = line.match(
      new RegExp(`^\\s*${pick}\\.\\s*\\[(\\d+)\\]\\s+\\S+\\s*—\\s*"([^"]+)"`)
    );
    if (quoted?.[1] && quoted[2]) {
      return {
        sectionIndex: parseInt(quoted[1], 10),
        title: quoted[2].trim(),
      };
    }

    const plain = line.match(
      new RegExp(`^\\s*${pick}\\.\\s*\\[(\\d+)\\]\\s+\\S+\\s*—\\s*(.+?)\\s*$`)
    );
    if (plain?.[1] && plain[2]) {
      return {
        sectionIndex: parseInt(plain[1], 10),
        title: plain[2].replace(/^"|"$/g, '').trim(),
      };
    }
  }
  return null;
}

function mergeStyleFollowUp(message: string, history: ConversationTurn[]): string | null {
  const lower = message.trim().toLowerCase();
  const prior = findPriorUserMessage(history, message);
  if (!prior) return null;

  for (const phrase of STYLE_FOLLOW_UP_PHRASES) {
    if (lower === phrase || lower.includes(phrase)) {
      return `${prior.content} (${phrase})`;
    }
  }

  if (/^(\d)\s*—/.test(message.trim()) && wasAssistantClarificationAsked(history)) {
    const pick = message.trim().match(/^(\d)/)?.[1];
    if (pick) {
      const assistant = lastAssistantTurn(history);
      const title = assistant
        ? extractSectionTitleFromListReply(assistant.content, parseInt(pick, 10))
        : null;
      if (title) {
        return `${prior.content} (target section: "${title}")`;
      }
    }
  }

  return null;
}

function mergeTestimonialOptionReply(message: string, history: ConversationTurn[]): string | null {
  if (!wasTestimonialCardClarificationAsked(history)) return null;

  const lower = message.trim().toLowerCase();
  const prior = findPriorUserMessage(history, message);
  const color =
    (prior ? extractColorsFromMessage(prior.content) : []).pop() ??
    extractColorsFromMessage(message).pop();
  const colorPhrase = color ? ` to ${color}` : '';

  if (/^1\b|all testimonial|all card backgrounds?/i.test(lower)) {
    return `change all testimonial card backgrounds${colorPhrase}`;
  }
  if (/^3\b|text color/i.test(lower)) {
    return `change testimonial section text color${colorPhrase}`;
  }

  return null;
}

function mergeSectionNumberReply(message: string, history: ConversationTurn[]): string | null {
  const numMatch = message.trim().match(/^(\d)\s*(?:—|$|\b)/);
  if (!numMatch || !wasSectionListClarificationAsked(history)) return null;

  const pick = parseInt(numMatch[1], 10);
  const assistant = lastSectionListAssistantTurn(history);
  const pickInfo = assistant ? extractSectionPickFromListReply(assistant.content, pick) : null;
  if (!pickInfo) return null;

  const prior = findPriorUserMessage(history, message);
  if (prior) {
    return `${prior.content} (target section index ${pickInfo.sectionIndex}; title "${pickInfo.title}")`;
  }
  return `${message.trim()} for section index ${pickInfo.sectionIndex} ("${pickInfo.title}")`;
}

function mergeDeicticFollowUp(message: string, history: ConversationTurn[]): string | null {
  const trimmed = message.trim();
  const isDeictic =
    /^(this|that|it)\b/i.test(trimmed) ||
    /\b(this|that)\s+section\b/i.test(trimmed) ||
    /\b(below|above)\b/i.test(trimmed);
  if (!isDeictic) return null;

  const prior = findPriorUserMessage(history, message);
  if (!prior || prior.content.length <= trimmed.length + 8) return null;

  return `${prior.content} — follow-up: ${trimmed}`;
}

/**
 * Merge clarification follow-ups and short replies with prior user intent.
 * Closest messages in history carry the most weight when resolving.
 */
export function resolveEffectiveEditMessage(
  message: string,
  history: ConversationTurn[] = []
): string {
  const recent = history.slice(-DEFAULT_EDIT_CONTEXT_TURNS);

  return (
    mergeTestimonialOptionReply(message, recent) ??
    mergeSectionNumberReply(message, recent) ??
    mergeStyleFollowUp(message, recent) ??
    mergeDeicticFollowUp(message, recent) ??
    message
  );
}

/**
 * Format chat history for LLM / intent clarifier prompts with recency weighting.
 */
export function formatWeightedConversationForPrompt(
  history: ConversationTurn[] | undefined,
  maxTurns = DEFAULT_EDIT_CONTEXT_TURNS
): string {
  if (!history?.length) return '';

  const turns = history.slice(-maxTurns);
  const lines = turns.map((turn, index) => {
    const fromEnd = turns.length - 1 - index;
    const stars = recencyStars(fromEnd);
    const label = turn.role === 'assistant' ? 'Assistant' : 'User';
    const weightNote =
      fromEnd === 0 && turn.role === 'user'
        ? ' [CURRENT — highest weight]'
        : fromEnd <= 1
          ? ' [high recency]'
          : '';
    return `${stars} ${label}${weightNote}: ${turn.content.trim()}`;
  });

  return (
    'CONVERSATION CONTEXT (recency-weighted — ★★★ = most recent; use earlier turns only to disambiguate):\n' +
    `${lines.join('\n')}\n\n`
  );
}

/**
 * Block for intent clarifier / classifier: weighted history + resolved effective request.
 */
export function formatConversationForIntentClarifier(
  message: string,
  history: ConversationTurn[] | undefined,
  catalogBlock?: string
): string {
  const effective = resolveEffectiveEditMessage(message, history ?? []);
  const historyBlock = formatWeightedConversationForPrompt(history);
  const effectiveBlock =
    effective.trim() !== message.trim()
      ? `RESOLVED REQUEST (merged from recent clarification context):\n"${effective.trim()}"\n\n`
      : '';
  const catalogSection = catalogBlock?.trim()
    ? `${catalogBlock.trim()}\n\n`
    : '';

  return `${historyBlock}${catalogSection}${effectiveBlock}`;
}
