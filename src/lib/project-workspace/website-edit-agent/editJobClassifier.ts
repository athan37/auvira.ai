import { hasExplicitEditTarget } from './enrichEditPrompt';
import {
  detectAmbiguousEditRequest,
  detectScopedStyleRequest,
  isTestimonialsCardColorRequest,
  isTestimonialsTextColorRequest,
  resolveEffectiveEditMessage,
  type ConversationTurn,
} from './editAmbiguity';
import { routeEditRequest } from './intentRouter';
import {
  isTextColorEditRequest,
  isBackgroundColorEditRequest,
} from '../verifyPreviewHints';
import { extractColorsFromMessage } from './preset/presetUtils';
import { parseColorSwap, TAILWIND_COLOR_NAMES } from './preset/presetUtils';
import { isGalleryDescriptionRequest } from './galleryItemDescriptionStrategy';
import {
  isImagePlacementRequest,
  MISSING_IMAGE_ATTACHMENT_MESSAGE,
} from './imagePlacementIntent';
import type { EditJobPlan, EditIntent, EditStrategyId, EditTier, EditTargetPlan } from './types';
import type { SiteWorkspaceSnapshot } from './resolveSiteWorkspace';
import type { WorkspaceAssetAttachment } from '../workspaceAssetTypes';

function messageHasKeyword(message: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(message);
}

function detectCompoundIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const hasAnd = /\band\b/.test(lower) || /,/.test(message);
  if (!hasAnd) return false;
  const buckets = [
    /\b(background|color|colour)\b/.test(lower) ||
      TAILWIND_COLOR_NAMES.some((c) => messageHasKeyword(lower, c)),
    /\b(faq|section|testimonial|gallery)\b/.test(lower),
    /\b(headline|title|tagline)\b/.test(lower),
    /\b(phone|email|address|contact)\b/.test(lower),
  ];
  return buckets.filter(Boolean).length >= 2;
}

function parseSectionRemoveTarget(message: string): string | null {
  const lower = message.toLowerCase();
  if (!/\b(remove|delete|hide)\b/.test(lower) || !/\bsection\b/.test(lower)) {
    return null;
  }
  for (const type of [
    'faq',
    'testimonials',
    'testimonial',
    'gallery',
    'services',
    'about',
    'contact',
    'generic',
  ]) {
    if (messageHasKeyword(lower, type)) return type === 'testimonial' ? 'testimonials' : type;
  }
  const quoted = message.match(/["']([^"']{2,60})["']/);
  if (quoted?.[1]) return quoted[1].trim();
  return null;
}

function parseSectionReorder(message: string): { type: string; direction: 'up' | 'down' } | null {
  const lower = message.toLowerCase();
  if (!/\b(move|reorder|above|below|before|after)\b/.test(lower)) return null;
  for (const type of ['faq', 'testimonials', 'gallery', 'services', 'contact']) {
    if (messageHasKeyword(lower, type)) {
      const direction = /\b(up|above|before)\b/.test(lower) ? 'up' : 'down';
      return { type, direction };
    }
  }
  return null;
}

function parseContactField(message: string): 'phone' | 'email' | 'address' | null {
  const lower = message.toLowerCase();
  if (messageHasKeyword(lower, 'phone')) return 'phone';
  if (messageHasKeyword(lower, 'email')) return 'email';
  if (messageHasKeyword(lower, 'address')) return 'address';
  return null;
}

function buildTryOrder(primary: EditStrategyId, fallbacks: EditStrategyId[]): EditStrategyId[] {
  const seen = new Set<EditStrategyId>();
  const order: EditStrategyId[] = [];
  for (const id of [primary, ...fallbacks]) {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  if (!seen.has('single_shot')) order.push('single_shot');
  if (!seen.has('section_config')) order.push('section_config');
  return order;
}

function routeFromGroundedPlan(
  plan: EditTargetPlan,
  legacyApplyLabel: string
): EditJobPlan | null {
  const { where, what, valueExplicit } = plan;

  if (where.confidence === 'low') {
    return {
      intents: ['section'],
      tier: 'L3',
      primaryStrategy: 'agent_loop',
      tryOrder: ['agent_loop'],
      confidence: 'low',
      verifyProfile: 'generic',
      applyLabel: legacyApplyLabel,
      needsClarification: true,
      clarificationMessage: where.clarificationMessage,
      suggestedReplies: where.suggestedReplies,
    };
  }

  if (what === 'copy' && where.kind === 'section' && where.sectionIndex != null) {
    if (!valueExplicit) {
      return {
        intents: ['copy', 'section'],
        tier: 'L2',
        primaryStrategy: 'section_config',
        tryOrder: buildTryOrder('section_config', ['section_copy_field']),
        confidence: 'medium',
        verifyProfile: 'copy',
        applyLabel: 'Updating section text',
        needsClarification: true,
        clarificationMessage: 'What should the new text be? Paste the exact wording you want.',
      };
    }
    return {
      intents: ['copy', 'section'],
      tier: 'L0',
      primaryStrategy: 'section_copy_field',
      tryOrder: buildTryOrder('section_copy_field', ['section_config']),
      confidence: where.confidence,
      verifyProfile: 'copy',
      applyLabel: 'Updating section text',
    };
  }

  if (what === 'style_background' && where.kind === 'section' && where.sectionIndex != null) {
    return {
      intents: ['style', 'section'],
      tier: 'L0',
      primaryStrategy: 'section_style',
      tryOrder: buildTryOrder('section_style', ['preset_theme']),
      confidence: where.confidence,
      verifyProfile: 'color',
      applyLabel: 'Updating section background',
    };
  }

  if (what === 'style_card' && where.sectionType === 'testimonials') {
    return {
      intents: ['style', 'section'],
      tier: 'L0',
      primaryStrategy: 'preset_card_color',
      tryOrder: buildTryOrder('preset_card_color', []),
      confidence: where.confidence,
      verifyProfile: 'color',
      applyLabel: 'Updating testimonial card colors',
    };
  }

  if (what === 'style_text' && where.kind === 'section') {
    return {
      intents: ['style', 'copy'],
      tier: 'L0',
      primaryStrategy: 'preset_text_color',
      tryOrder: buildTryOrder('preset_text_color', ['section_style']),
      confidence: where.confidence,
      verifyProfile: 'color',
      applyLabel: 'Updating section text color',
    };
  }

  if (what === 'structure' && where.kind === 'section' && where.sectionIndex != null) {
    return {
      intents: ['section'],
      tier: 'L2',
      primaryStrategy: 'section_config',
      tryOrder: buildTryOrder('section_config', []),
      confidence: where.confidence,
      verifyProfile: 'section',
      applyLabel: legacyApplyLabel,
    };
  }

  return null;
}

/**
 * Classify an owner edit message into tier, strategy, and verification profile.
 */
export function classifyEditJob(
  ownerMessage: string,
  attachments: WorkspaceAssetAttachment[] = [],
  snap?: SiteWorkspaceSnapshot | null,
  conversationHistory: ConversationTurn[] = [],
  editTargetPlan?: EditTargetPlan | null
): EditJobPlan {
  const effectiveMessage = resolveEffectiveEditMessage(ownerMessage, conversationHistory);
  const legacy = routeEditRequest(effectiveMessage);
  const intents: EditIntent[] = [legacy.intent];
  const lower = effectiveMessage.toLowerCase();
  const hasAttachments = attachments.length > 0;

  if (hasAttachments) {
    return {
      intents: ['section'],
      tier: 'L0',
      primaryStrategy: 'image_gallery',
      tryOrder: ['image_gallery', 'hero_image', 'gallery_captions', 'static_gallery'],
      confidence: 'high',
      verifyProfile: 'image',
      applyLabel: legacy.applyLabel,
    };
  }

  if (editTargetPlan && snap?.mode === 'gitlab') {
    const groundedRoute = routeFromGroundedPlan(editTargetPlan, legacy.applyLabel);
    if (groundedRoute && !groundedRoute.needsClarification) {
      return groundedRoute;
    }
    if (groundedRoute?.needsClarification) {
      return groundedRoute;
    }
  }

  if (isGalleryDescriptionRequest(effectiveMessage)) {
    return {
      intents: ['section', 'copy'],
      tier: 'L1',
      primaryStrategy: 'gallery_captions',
      tryOrder: buildTryOrder('gallery_captions', ['section_config']),
      confidence: 'high',
      verifyProfile: 'section',
      applyLabel: 'Updating image descriptions',
    };
  }

  if (isImagePlacementRequest(effectiveMessage)) {
    return {
      intents: ['section'],
      tier: 'L0',
      primaryStrategy: 'image_gallery',
      tryOrder: [],
      confidence: 'high',
      verifyProfile: 'image',
      applyLabel: 'Waiting for image upload',
      needsClarification: true,
      clarificationMessage: MISSING_IMAGE_ATTACHMENT_MESSAGE,
    };
  }

  if (detectCompoundIntent(effectiveMessage)) {
    return {
      intents: ['general', legacy.intent],
      tier: 'L3',
      primaryStrategy: 'agent_loop',
      tryOrder: ['agent_loop'],
      confidence: 'low',
      verifyProfile: 'generic',
      applyLabel: legacy.applyLabel,
      needsClarification: true,
      clarificationMessage:
        'That request includes several changes. For fastest results, try one change per message (e.g. color first, then add FAQ).',
    };
  }

  const ambiguity = detectAmbiguousEditRequest(
    ownerMessage,
    conversationHistory,
    editTargetPlan ?? undefined
  );
  if (ambiguity.ambiguous && ambiguity.confidence !== 'high') {
    return {
      intents: ['style', 'section'],
      tier: 'L3',
      primaryStrategy: 'agent_loop',
      tryOrder: ['agent_loop'],
      confidence: 'low',
      verifyProfile: 'generic',
      applyLabel: legacy.applyLabel,
      needsClarification: true,
      clarificationMessage: ambiguity.clarificationMessage,
      suggestedReplies: ambiguity.suggestedReplies,
    };
  }

  if (snap?.mode === 'static') {
    const swap = parseColorSwap(effectiveMessage);
    if (swap || isBackgroundColorEditRequest(effectiveMessage)) {
      return {
        intents: ['style'],
        tier: 'L0',
        primaryStrategy: 'static_theme',
        tryOrder: buildTryOrder('static_theme', []),
        confidence: swap ? 'high' : 'medium',
        verifyProfile: 'color',
        applyLabel: 'Updating the design colors',
      };
    }
    if (hasExplicitEditTarget(effectiveMessage)) {
      return {
        intents: ['copy'],
        tier: 'L0',
        primaryStrategy: 'static_copy',
        tryOrder: buildTryOrder('static_copy', []),
        confidence: 'high',
        verifyProfile: 'copy',
        applyLabel: 'Updating the text',
      };
    }
  }

  const sectionRemove = parseSectionRemoveTarget(effectiveMessage);
  if (sectionRemove) {
    return {
      intents: ['section'],
      tier: 'L0',
      primaryStrategy: 'section_remove',
      tryOrder: buildTryOrder('section_remove', []),
      confidence: 'high',
      verifyProfile: 'section',
      applyLabel: 'Updating the page section',
    };
  }

  const reorder = parseSectionReorder(effectiveMessage);
  if (reorder) {
    return {
      intents: ['section'],
      tier: 'L0',
      primaryStrategy: 'section_reorder',
      tryOrder: buildTryOrder('section_reorder', []),
      confidence: 'high',
      verifyProfile: 'section',
      applyLabel: 'Updating the page section',
    };
  }

  const contactField = parseContactField(effectiveMessage);
  if (contactField && hasExplicitEditTarget(effectiveMessage)) {
    return {
      intents: ['contact'],
      tier: 'L0',
      primaryStrategy: 'contact_field',
      tryOrder: buildTryOrder('contact_field', []),
      confidence: 'high',
      verifyProfile: 'contact',
      applyLabel: 'Updating the contact details',
    };
  }

  if (isTestimonialsTextColorRequest(effectiveMessage)) {
    const colors = extractColorsFromMessage(effectiveMessage);
    if (colors.length > 0) {
      return {
        intents: ['style', 'copy'],
        tier: 'L0',
        primaryStrategy: 'preset_text_color',
        tryOrder: buildTryOrder('preset_text_color', []),
        confidence: 'high',
        verifyProfile: 'color',
        applyLabel: 'Updating the design colors',
      };
    }
  }

  if (isTestimonialsCardColorRequest(effectiveMessage)) {
    const colors = extractColorsFromMessage(effectiveMessage);
    if (colors.length > 0) {
      return {
        intents: ['style'],
        tier: 'L0',
        primaryStrategy: 'preset_card_color',
        tryOrder: buildTryOrder('preset_card_color', []),
        confidence: 'high',
        verifyProfile: 'color',
        applyLabel: 'Updating testimonial card colors',
      };
    }
  }

  if (isTextColorEditRequest(effectiveMessage)) {
    const colors = extractColorsFromMessage(effectiveMessage);
    const toColor = colors[colors.length - 1];
    if (toColor) {
      return {
        intents: ['style', 'copy'],
        tier: 'L0',
        primaryStrategy: 'preset_text_color',
        tryOrder: buildTryOrder('preset_text_color', []),
        confidence: 'high',
        verifyProfile: 'color',
        applyLabel: 'Updating the design colors',
      };
    }
  }

  const colorSwap = parseColorSwap(effectiveMessage);
  const siteWideColor =
    isBackgroundColorEditRequest(effectiveMessage) ||
    (colorSwap && /\b(throughout|everywhere|site|whole)\b/.test(lower));

  if (
    colorSwap &&
    (siteWideColor || messageHasKeyword(lower, 'background')) &&
    !/\bfirst\s+section\b|\bsecond\s+section\b|\blast\s+section\b/.test(lower)
  ) {
    return {
      intents: ['style'],
      tier: 'L0',
      primaryStrategy: 'preset_theme',
      tryOrder: buildTryOrder('preset_theme', []),
      confidence: 'high',
      verifyProfile: 'color',
      applyLabel: 'Updating the design colors',
    };
  }

  if (colorSwap && messageHasKeyword(lower, 'hero')) {
    return {
      intents: ['style'],
      tier: 'L0',
      primaryStrategy: 'preset_theme',
      tryOrder: buildTryOrder('preset_theme', []),
      confidence: 'high',
      verifyProfile: 'color',
      applyLabel: 'Updating the hero section',
    };
  }

  if (
    hasExplicitEditTarget(effectiveMessage) &&
    (legacy.intent === 'copy' ||
      messageHasKeyword(lower, 'headline') ||
      messageHasKeyword(lower, 'tagline'))
  ) {
    return {
      intents: ['copy'],
      tier: 'L0',
      primaryStrategy: 'copy_field',
      tryOrder: buildTryOrder('copy_field', []),
      confidence: 'high',
      verifyProfile: 'copy',
      applyLabel: 'Updating the text content',
    };
  }

  if (/\b(nav|menu|footer|copyright|cta|button)\b/.test(lower) && hasExplicitEditTarget(effectiveMessage)) {
    intents.push('chrome');
    return {
      intents,
      tier: 'L0',
      primaryStrategy: 'chrome_field',
      tryOrder: buildTryOrder('chrome_field', []),
      confidence: 'high',
      verifyProfile: 'copy',
      applyLabel: 'Updating navigation and buttons',
    };
  }

  if (/\b(seo|meta title|page title|description)\b/.test(lower) && hasExplicitEditTarget(effectiveMessage)) {
    intents.push('meta');
    return {
      intents,
      tier: 'L0',
      primaryStrategy: 'meta_field',
      tryOrder: buildTryOrder('meta_field', []),
      confidence: 'high',
      verifyProfile: 'copy',
      applyLabel: 'Updating page metadata',
    };
  }

  if (
    legacy.intent === 'section' &&
    /\bfaq\b/.test(lower) &&
    (/\badd\b/.test(lower) || /\d+/.test(effectiveMessage))
  ) {
    return {
      intents: ['section'],
      tier: 'L1',
      primaryStrategy: 'section_faq_template',
      tryOrder: buildTryOrder('section_faq_template', ['section_config']),
      confidence: 'medium',
      verifyProfile: 'section',
      applyLabel: 'Updating the page section',
    };
  }

  if (
    legacy.intent === 'section' &&
    snap?.mode === 'gitlab' &&
    !detectScopedStyleRequest(effectiveMessage)
  ) {
    return {
      intents: ['section'],
      tier: 'L2',
      primaryStrategy: 'section_config',
      tryOrder: buildTryOrder('section_config', []),
      confidence: 'medium',
      verifyProfile: 'section',
      applyLabel: legacy.applyLabel,
    };
  }

  const legacyDecision = routeEditRequest(effectiveMessage);
  if (legacyDecision.strategy === 'single_shot') {
    return {
      intents: [legacy.intent],
      tier: 'L2',
      primaryStrategy: 'single_shot',
      tryOrder: buildTryOrder('single_shot', []),
      confidence: 'medium',
      verifyProfile: legacy.intent === 'style' ? 'color' : 'generic',
      applyLabel: legacy.applyLabel,
    };
  }

  return {
    intents: [legacy.intent],
    tier: 'L3',
    primaryStrategy: 'agent_loop',
    tryOrder: ['agent_loop'],
    confidence: 'low',
    verifyProfile: 'generic',
    applyLabel: legacy.applyLabel,
  };
}
