import type { EditIntent, EditStrategyKind, RouterDecision } from './types';
import { hasExplicitEditTarget } from './enrichEditPrompt';

/** True when the owner attached one or more images to this edit request. */
export function hasImageAttachments(attachmentCount: number): boolean {
  return attachmentCount > 0;
}

function classifyIntent(message: string): EditIntent {
  const lower = message.toLowerCase();

  if (
    /\b(phone|email|address|contact|hours)\b/.test(lower) &&
    !/\b(background|color|section)\b/.test(lower)
  ) {
    return 'contact';
  }

  if (/\b(section|add a|add new|another|new block|testimonial|faq|portfolio)\b/.test(lower)) {
    return 'section';
  }

  if (/\b(headline|subheadline|title|paragraph|tagline|wording|text)\b/.test(lower)) {
    return 'copy';
  }

  if (
    /\b(background|color|colour|font|style)\b/.test(lower) ||
    /\b(green|blue|red|yellow|orange|purple|pink|black|white)\b/.test(lower)
  ) {
    return 'style';
  }

  return 'general';
}

function applyLabelForIntent(intent: EditIntent): string {
  switch (intent) {
    case 'style':
      return 'Updating the design colors';
    case 'section':
      return 'Updating the page section';
    case 'contact':
      return 'Updating the contact details';
    case 'copy':
      return 'Updating the text content';
    default:
      return 'Applying your requested change';
  }
}

/**
 * Rule-based router: style intents may use single-shot; others use agent loop.
 */
export function routeEditRequest(message: string): RouterDecision {
  const intent = classifyIntent(message);
  const lower = message.toLowerCase();

  const styleHighConfidence =
    intent === 'style' &&
    !/\b(section|add|remove|delete|paragraph|content)\b/.test(lower) &&
    (!/\bhero\b/.test(lower) || /\b(background|color|colour)\b/.test(lower));

  const copyWithTarget = intent === 'copy' && hasExplicitEditTarget(message);

  const strategy: EditStrategyKind =
    styleHighConfidence || copyWithTarget ? 'single_shot' : 'agent_loop';

  return {
    intent,
    strategy,
    applyLabel: applyLabelForIntent(intent),
  };
}

/** @deprecated Use routeEditRequest — kept for tests */
export function isTrivialStyleEdit(message: string): boolean {
  return routeEditRequest(message).strategy === 'single_shot';
}
