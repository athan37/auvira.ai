import { hasExplicitEditTarget } from './enrichEditPrompt';
import { wantsNewImageSection } from './imagePlacementIntent';
import type { ConversationTurn } from './editAmbiguity';
import { resolveEffectiveEditMessage } from '@/lib/chat/conversationContextForEdit';
import { buildEditContext } from '@/lib/project-workspace/edit-context/buildEditContext';
import { resolveEditTargetAsync } from '@/lib/project-workspace/edit-context/resolveEditTarget';
import type { EditTarget } from '@/lib/project-workspace/edit-context/types';
import type { SiteModel } from '@/lib/project-workspace/site-model/types';
import { extractEditCodeContext, formatCodeContextBlocks } from './extractEditCodeContext';
import { buildEnrichedSiteStructure } from './resolveSectionTarget';
import { buildSiteSectionCatalog } from './siteSectionCatalog';
import type { SiteWorkspaceSnapshot } from './resolveSiteWorkspace';
import {
  isBackgroundColorEditRequest,
  isTextColorEditRequest,
} from '../verifyPreviewHints';
import type {
  EditTargetPlan,
  EditWhatKind,
  GroundedEditContextResult,
  SectionTargetResult,
} from './types';

function messageHasKeyword(message: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(message);
}

/** Classify WHAT the owner wants to change from the message. */
export function classifyEditWhat(message: string): EditWhatKind {
  const lower = message.toLowerCase();
  const hasColorSignal =
    /\b(backgrounds?|colours?|colors?)\b/.test(lower) ||
    isBackgroundColorEditRequest(message) ||
    isTextColorEditRequest(message);

  if (/\bcard\b/.test(lower) && /\b(backgrounds?|colours?|colors?)\b/.test(lower)) {
    return 'style_card';
  }

  if (
    isTextColorEditRequest(message) ||
    (/\btext\b/.test(lower) && /\b(colours?|colors?)\b/.test(lower))
  ) {
    return 'style_text';
  }

  if (
    isBackgroundColorEditRequest(message) ||
    (/\bbackgrounds?\b/.test(lower) && !/\bcard\b/.test(lower))
  ) {
    return 'style_background';
  }

  if (/\b(image|photo|picture|gallery|upload)\b/.test(lower) && !hasColorSignal) {
    return 'images';
  }

  if (
    (/\b(add|remove|delete|reorder|move|append|insert)\b/.test(lower) ||
      /\bfaq\b/.test(lower)) &&
    !/\b(background|colour|color)\b/.test(lower)
  ) {
    return 'structure';
  }

  if (
    /\b(text|copy|headline|title|body|wording|rename|edit)\b/.test(lower) ||
    hasExplicitEditTarget(message)
  ) {
    return 'copy';
  }

  if (messageHasKeyword(lower, 'section')) {
    return 'structure';
  }

  return 'structure';
}

function buildResolvedTargetSummary(plan: EditTargetPlan): string {
  const { where, what } = plan;
  const lines = ['RESOLVED EDIT TARGET:'];

  if (where.kind === 'hero') {
    lines.push(`  Hero — change: ${what}`);
  } else if (where.kind === 'nav') {
    lines.push(`  Navigation — change: ${what}`);
  } else if (where.kind === 'footer') {
    lines.push(`  Footer — change: ${what}`);
  } else if (where.sectionIndex != null) {
    lines.push(
      `  Section [${where.sectionIndex}] ${where.sectionType ?? 'unknown'} — "${where.title ?? ''}" — change: ${what}`
    );
    if (where.rendererComponent) {
      lines.push(`  Renderer: ${where.rendererComponent} in src/app/page.tsx`);
    }
  } else {
    lines.push(`  (unresolved section) — change: ${what}`);
  }

  return lines.join('\n');
}

export function formatEditTargetPlanForPrompt(plan: EditTargetPlan): string {
  return [
    plan.structureBrief,
    '',
    buildResolvedTargetSummary(plan),
    '',
    'EXTRACTED CODE (edit these regions):',
    formatCodeContextBlocks(plan.codeBlocks),
  ].join('\n');
}

function needsWhatClarification(what: EditWhatKind, message: string): GroundedEditContextResult | null {
  const lower = message.toLowerCase();
  const vagueSection =
    messageHasKeyword(lower, 'section') &&
    !/\b(background|color|colour|text|copy|title|headline|body|faq|add|remove|image)\b/.test(
      lower
    ) &&
    !hasExplicitEditTarget(message);

  if (vagueSection && what === 'structure') {
    return {
      needsClarification: true,
      clarificationMessage:
        'What would you like to change about that section?\n\n' +
        '- **Copy** (title, body, or item text)\n' +
        '- **Background** or section styling\n' +
        '- **Structure** (add/remove items or sections)',
      suggestedReplies: [
        'Change section text/copy',
        'Change section background',
        'Add or update section content',
      ],
    };
  }

  if (what === 'copy' && !hasExplicitEditTarget(message)) {
    return {
      needsClarification: true,
      clarificationMessage: 'What should the new text be? Paste the exact wording you want.',
      suggestedReplies: [],
    };
  }

  return null;
}

function siteModelFromSnapshot(
  snap: SiteWorkspaceSnapshot,
  workspacePath: string
): SiteModel {
  const siteConfigContent = snap.siteConfigContent ?? '';
  const pageContent = snap.pageContent ?? '';
  let structure = null;
  if (siteConfigContent && pageContent) {
    try {
      structure = buildEnrichedSiteStructure(siteConfigContent, pageContent);
    } catch {
      structure = null;
    }
  }

  return {
    workspacePath,
    mode: 'gitlab',
    archetype: snap.archetype,
    siteConfigPath: snap.siteConfigPath,
    pagePath: snap.pagePath,
    indexHtmlPath: snap.indexHtmlPath,
    siteJsonPath: snap.siteJsonPath,
    stylesPath: snap.stylesPath,
    siteConfigContent,
    pageContent,
    indexHtmlContent: snap.indexHtmlContent,
    siteJsonContent: snap.siteJsonContent,
    parsedConfig: null,
    structure,
    errors: [],
  };
}

function editTargetToSectionWhere(target: EditTarget): SectionTargetResult {
  if (target.kind === 'hero') {
    return { confidence: target.confidence, kind: 'hero', reason: target.reason };
  }
  if (target.kind === 'nav') {
    return { confidence: target.confidence, kind: 'nav', reason: target.reason };
  }
  if (target.kind === 'footer') {
    return { confidence: target.confidence, kind: 'footer', reason: target.reason };
  }

  return {
    confidence: target.confidence,
    kind: 'section',
    sectionIndex: target.sectionIndex,
    sectionType: target.sectionType,
    title: target.title,
    rendererComponent: target.rendererComponent,
    clarificationMessage: target.clarificationMessage,
    suggestedReplies: target.suggestedReplies,
    reason: target.reason,
  };
}

/**
 * Pre-flight grounding for legacy V1: delegates target resolution to {@link buildEditContext}.
 */
export async function buildGroundedEditContext(
  snap: SiteWorkspaceSnapshot | null,
  message: string,
  history: ConversationTurn[] = [],
  workspacePath = ''
): Promise<GroundedEditContextResult> {
  if (!snap || snap.mode !== 'gitlab') {
    return { plan: undefined };
  }

  const siteConfigContent = snap.siteConfigContent ?? '';
  const pageContent = snap.pageContent ?? '';
  if (!siteConfigContent || !pageContent) {
    return { plan: undefined };
  }

  const sectionCatalog = buildSiteSectionCatalog(siteConfigContent, pageContent);
  const structureBrief = sectionCatalog.textBlock;

  let effectiveMessage: string;
  let where: SectionTargetResult;

  if (workspacePath) {
    const built = await buildEditContext({
      workspacePath,
      mode: 'gitlab',
      ownerMessage: message,
      conversationHistory: history,
    });

    effectiveMessage = built.context.effectiveMessage;

    if (built.needsClarification && built.clarificationMessage) {
      return {
        needsClarification: true,
        clarificationMessage: built.clarificationMessage,
        suggestedReplies: built.suggestedReplies ?? sectionCatalog.numberedReplies,
        sectionCatalog,
      };
    }

    where = editTargetToSectionWhere(built.context.target);
  } else {
    effectiveMessage = resolveEffectiveEditMessage(message, history);
    const siteModel = siteModelFromSnapshot(snap, '/tmp/grounded-edit');
    const target = await resolveEditTargetAsync(message, siteModel, sectionCatalog, history);

    if (target.needsClarification && target.clarificationMessage) {
      return {
        needsClarification: true,
        clarificationMessage: target.clarificationMessage,
        suggestedReplies: target.suggestedReplies ?? sectionCatalog.numberedReplies,
        sectionCatalog,
      };
    }

    where = editTargetToSectionWhere(target);
  }

  if (
    where.clarificationMessage &&
    where.confidence !== 'high' &&
    !wantsNewImageSection(effectiveMessage)
  ) {
    return {
      needsClarification: true,
      clarificationMessage: where.clarificationMessage,
      suggestedReplies: where.suggestedReplies ?? sectionCatalog.numberedReplies,
      sectionCatalog,
    };
  }

  const what = classifyEditWhat(effectiveMessage);
  const whatClarification = needsWhatClarification(what, effectiveMessage);
  if (whatClarification) {
    return { ...whatClarification, sectionCatalog };
  }

  const enriched = buildEnrichedSiteStructure(siteConfigContent, pageContent);
  const codeBlocks = await extractEditCodeContext({
    target: where,
    siteConfigContent,
    pageContent,
    snapshot: enriched,
    workspacePath,
    mode: snap.mode,
    ownerMessage: effectiveMessage,
  });

  const plan: EditTargetPlan = {
    where,
    what,
    valueExplicit: hasExplicitEditTarget(effectiveMessage),
    codeBlocks,
    structureBrief,
    sectionCatalog,
  };

  return { plan, sectionCatalog };
}

/** Adjust WHERE confidence when WHAT is ambiguous (medium confidence). */
export function adjustTargetConfidenceForWhat(
  where: SectionTargetResult,
  what: EditWhatKind
): SectionTargetResult {
  if (where.confidence !== 'high' && where.confidence !== 'medium') {
    return where;
  }

  const styleWhat = what === 'style_background' || what === 'style_text' || what === 'style_card';
  if (styleWhat && where.kind === 'section') {
    return { ...where, confidence: where.confidence === 'high' ? 'medium' : where.confidence };
  }

  return where;
}
