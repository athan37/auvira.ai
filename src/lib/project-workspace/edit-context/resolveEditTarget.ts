import { resolveEffectiveEditMessage } from '@/lib/chat/conversationContextForEdit';
import { classifyEditWhat } from '@/lib/project-workspace/website-edit-agent/buildGroundedEditContext';
import type { ConversationTurn } from '@/lib/project-workspace/website-edit-agent/editAmbiguity';
import {
  extractSectionTitleCandidates,
  resolveSectionTarget,
} from '@/lib/project-workspace/website-edit-agent/resolveSectionTarget';
import {
  matchSectionFromMessage,
  type SiteSectionCatalog,
} from '@/lib/project-workspace/website-edit-agent/siteSectionCatalog';
import type { SiteModel } from '@/lib/project-workspace/site-model/types';
import type { EditTarget, EditTargetCandidate, EditTargetKind } from './types';

function toCandidate(
  kind: EditTargetKind,
  sectionIndex: number | undefined,
  sectionType: string | undefined,
  title: string | undefined,
  confidence: 'high' | 'medium' | 'low',
  reason?: string
): EditTargetCandidate {
  return {
    kind,
    sectionIndex,
    sectionTitle: title,
    sectionType,
    confidence,
    reason,
  };
}

function heroTarget(confidence: 'high' | 'medium' | 'low', reason: string): EditTarget {
  return {
    kind: 'hero',
    confidence,
    candidates: [toCandidate('hero', undefined, undefined, undefined, confidence, reason)],
    needsClarification: false,
    reason,
  };
}

/**
 * Resolve edit target from message + catalog. Quoted titles beat deictic "this section".
 */
export function resolveEditTarget(
  message: string,
  siteModel: SiteModel,
  catalog: SiteSectionCatalog,
  history: ConversationTurn[] = []
): EditTarget {
  const effectiveMessage = resolveEffectiveEditMessage(message, history);
  const lower = effectiveMessage.toLowerCase();

  if (/\b(hero|headline|tagline|subheadline)\b/i.test(lower) && !/\bsection\b/i.test(lower)) {
    return heroTarget('high', 'Hero keyword match');
  }

  if (/\b(phone|email|address)\b/i.test(lower) && /\b(contact|call|reach)\b/i.test(lower)) {
    return {
      kind: 'site',
      confidence: 'high',
      candidates: [toCandidate('site', undefined, undefined, undefined, 'high', 'Contact field edit')],
      needsClarification: false,
      reason: 'Contact field edit',
    };
  }

  const titleCandidates = extractSectionTitleCandidates(effectiveMessage);
  const hasQuotedTitle = titleCandidates.length > 0;

  const catalogMatch = matchSectionFromMessage(effectiveMessage, catalog, { history });
  if (catalogMatch?.sectionIndex != null && catalogMatch.confidence === 'high') {
    return {
      kind: 'section',
      sectionIndex: catalogMatch.sectionIndex,
      sectionType: catalogMatch.sectionType,
      title: catalogMatch.title,
      rendererComponent: catalogMatch.rendererComponent,
      confidence: 'high',
      candidates: [
        toCandidate(
          'section',
          catalogMatch.sectionIndex,
          catalogMatch.sectionType,
          catalogMatch.title,
          'high',
          catalogMatch.reason
        ),
      ],
      needsClarification: false,
      reason: catalogMatch.reason,
    };
  }

  if (catalogMatch?.confidence === 'low' && catalogMatch.clarificationMessage) {
    const candidates: EditTargetCandidate[] =
      catalogMatch.matches?.map((m) =>
        toCandidate('section', m.index, m.type, m.title, 'low', 'Ambiguous section match')
      ) ?? [];
    return {
      kind: 'section',
      confidence: 'low',
      candidates,
      needsClarification: true,
      clarificationMessage: catalogMatch.clarificationMessage,
      suggestedReplies: catalogMatch.suggestedReplies,
      reason: 'Ambiguous section target',
    };
  }

  const enriched = siteModel.structure;
  if (enriched) {
    const legacy = resolveSectionTarget(effectiveMessage, history, enriched, catalog);
    if (legacy.sectionIndex != null && legacy.confidence !== 'low') {
      return {
        kind: 'section',
        sectionIndex: legacy.sectionIndex,
        sectionType: legacy.sectionType,
        title: legacy.title,
        rendererComponent: legacy.rendererComponent,
        confidence: legacy.confidence,
        candidates: [
          toCandidate(
            'section',
            legacy.sectionIndex,
            legacy.sectionType,
            legacy.title,
            legacy.confidence,
            legacy.reason
          ),
        ],
        needsClarification: false,
        reason: legacy.reason,
      };
    }
    if (legacy.clarificationMessage && !hasQuotedTitle) {
      return {
        kind: 'section',
        confidence: 'low',
        candidates:
          legacy.matches?.map((m) =>
            toCandidate('section', m.index, m.type, m.title, 'low')
          ) ?? [],
        needsClarification: true,
        clarificationMessage: legacy.clarificationMessage,
        suggestedReplies: legacy.suggestedReplies,
      };
    }
  }

  const what = classifyEditWhat(effectiveMessage);
  if (
    what.startsWith('style_') &&
    /\b(this|that)\s+section\b/i.test(effectiveMessage) &&
    !hasQuotedTitle
  ) {
    return {
      kind: 'section',
      confidence: 'low',
      candidates: catalog.sections.map((s) =>
        toCandidate('section', s.index, s.type, s.title, 'low', 'Deictic section reference')
      ),
      needsClarification: true,
      clarificationMessage:
        'Which section do you mean? Reply with the number:\n\n' +
        catalog.sections
          .map((s, i) => `${i + 1}. [${s.index}] ${s.type} — "${s.title}"`)
          .join('\n'),
      suggestedReplies: catalog.numberedReplies,
      reason: 'Deictic section without title',
    };
  }

  return {
    kind: 'site',
    confidence: 'medium',
    candidates: [],
    needsClarification: false,
    reason: 'Site-wide or unresolved target',
  };
}
