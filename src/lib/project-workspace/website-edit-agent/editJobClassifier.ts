import { hasExplicitEditTarget } from './enrichEditPrompt';
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
import type { EditJobPlan, EditIntent, EditStrategyId, EditTier } from './types';
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

/**
 * Classify an owner edit message into tier, strategy, and verification profile.
 */
export function classifyEditJob(
  ownerMessage: string,
  attachments: WorkspaceAssetAttachment[] = [],
  snap?: SiteWorkspaceSnapshot | null
): EditJobPlan {
  const legacy = routeEditRequest(ownerMessage);
  const intents: EditIntent[] = [legacy.intent];
  const lower = ownerMessage.toLowerCase();
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

  if (isGalleryDescriptionRequest(ownerMessage)) {
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

  if (isImagePlacementRequest(ownerMessage)) {
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

  if (detectCompoundIntent(ownerMessage)) {
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

  if (snap?.mode === 'static') {
    const swap = parseColorSwap(ownerMessage);
    if (swap || isBackgroundColorEditRequest(ownerMessage)) {
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
    if (hasExplicitEditTarget(ownerMessage)) {
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

  const sectionRemove = parseSectionRemoveTarget(ownerMessage);
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

  const reorder = parseSectionReorder(ownerMessage);
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

  const contactField = parseContactField(ownerMessage);
  if (contactField && hasExplicitEditTarget(ownerMessage)) {
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

  if (isTextColorEditRequest(ownerMessage)) {
    const colors = extractColorsFromMessage(ownerMessage);
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

  const colorSwap = parseColorSwap(ownerMessage);
  const siteWideColor =
    isBackgroundColorEditRequest(ownerMessage) ||
    (colorSwap && /\b(throughout|everywhere|site|whole)\b/.test(lower));

  if (colorSwap && (siteWideColor || messageHasKeyword(lower, 'background'))) {
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
    hasExplicitEditTarget(ownerMessage) &&
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

  if (/\b(nav|menu|footer|copyright|cta|button)\b/.test(lower) && hasExplicitEditTarget(ownerMessage)) {
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

  if (/\b(seo|meta title|page title|description)\b/.test(lower) && hasExplicitEditTarget(ownerMessage)) {
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
    (/\badd\b/.test(lower) || /\d+/.test(ownerMessage))
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

  if (legacy.intent === 'section' && snap?.mode === 'gitlab') {
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

  const legacyDecision = routeEditRequest(ownerMessage);
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

// Fix the typo block - I accidentally left broken code. Let me fix editJobClassifier.ts
