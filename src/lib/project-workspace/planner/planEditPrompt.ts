import {
  DEFAULT_EDIT_CONTEXT_TURNS,
  formatWeightedConversationForPrompt,
} from '@/lib/chat/conversationContextForEdit';
import {
  isGalleryDescriptionRequest,
  isSectionCardDescriptionRequest,
} from '@/lib/project-workspace/edit-shared/galleryItemDescriptionStrategy';
import type { EditContext } from '@/lib/project-workspace/edit-context/types';
import { formatStructureMap } from '@/lib/project-workspace/edit-shared/resolveSectionTarget';
import { resolveDuplicateCopyTarget } from '@/lib/project-workspace/edit-context/resolveDuplicateCopyTarget';
import { formatSelectedTargetForMessage } from '@/lib/project-workspace/edit-context/resolveSelectedTarget';
import {
  formatSelectedTargetContextBlock,
} from '@/lib/project-workspace/edit-context/selectedTargetContext';
import type {
  ObservabilityCoachingContext,
  ObservabilityProjectIntent,
} from '@/lib/observability/types';
import type { ImplicitReferenceRecord } from '@/lib/project-workspace/edit-context/implicitReferenceTypes';
import { formatReferenceSourceLabel } from '@/lib/project-workspace/edit-context/implicitReferenceResolver';
import { EDIT_SKILL_NAMES } from './editPlan.schema';

const MAX_VOCAB_KEYWORDS = 10;
const MAX_VOCAB_INTENTS = 5;

const PLANNER_SYSTEM = `You are Website Edit Agent planner for small business sites (siteConfig.ts + section-loop page.tsx).

Return ONLY valid JSON matching the schema. planVersion should be "website-agent".

Domain skills (executor maps these to typed tools — never use write_file for common edits):
${EDIT_SKILL_NAMES.map((s) => `- ${s}`).join('\n')}

Rules:
- Prefer config skills over custom_code_edit (never use custom_code_edit unless the owner explicitly asks for custom code or layout not covered by skills).
- Never set needsClarification false if any step lacks required params (value, sectionIndex, field, or color).
- Use clarificationQuestion (not clarificationMessage) when clarifying.
- update_section_style → section background/card via params.backgroundColor or params.presentation.backgroundClass; use params.presentationField "cardClass" when the owner names an inner element (e.g. "contact information background", "card background") — not the whole section wrapper.
- update_contact → params phone, email, or address with exact user value. Do NOT use update_contact when a contact section is UI-pinned and the owner changes "contact information" / "contact info" prose — use update_config_field on the pinned section subtitle (inner card heading) instead.
- update_hero → params headline, subheadline, or tagline with params.value.
- update_business_name → params value (siteConfig businessName only).
- Generic card/list edits on sections[i].items[] → add_section_item, duplicate_section_item, remove_section_item, update_section_item (use pinned sectionIndex and itemIndex; never custom_code_edit).
- add_section_item with cloneFromItemIndex when owner says "like this"; title-only add can use section pin without itemIndex.
- Target kind must be one of: section, hero, nav, footer, site, businessName.
- When the owner updates both business name and hero headline to the same text, emit update_business_name and update_hero steps (same value).
- When EditContext already resolved a section target, use that sectionIndex in target/params.
- If ambiguous or missing value, set needsClarification true, steps [], clarificationQuestion, suggestedReplies (2+).
- Do not invent business facts.`;

function dedupeShortStrings(values: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 80) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

/** Small project vocabulary block from Site Monitor /intent (optional). */
export function formatProjectVocabularyBlock(
  intent?: ObservabilityProjectIntent | null
): string | null {
  if (!intent || intent.turn_count === 0) return null;
  const keywords = dedupeShortStrings(intent.keywords, MAX_VOCAB_KEYWORDS);
  const intents = intent.intents
    .filter((entry) => entry.label.trim().length > 0)
    .slice(0, MAX_VOCAB_INTENTS)
    .map((entry) => `${entry.label} (${entry.count})`);
  if (keywords.length === 0 && intents.length === 0) return null;
  const lines = ['', '## Project vocabulary'];
  if (keywords.length > 0) {
    lines.push(`Recurring topics: ${keywords.join(', ')}`);
  }
  if (intents.length > 0) {
    lines.push(`Common edit types: ${intents.join(', ')}`);
  }
  return lines.join('\n');
}

/** Resolved implicit references for planner (only entries with concrete values). */
export function formatResolvedReferencesBlock(
  references?: ImplicitReferenceRecord[] | null
): string | null {
  if (!references?.length) return null;
  const resolved = references.filter((r) => r.resolvedValue?.trim());
  if (resolved.length === 0) return null;
  const lines = resolved.map(
    (r) =>
      `- "${r.phrase}" → "${r.resolvedValue}" (source: ${formatReferenceSourceLabel(r.source)})`
  );
  return ['', '## Resolved user references', ...lines].join('\n');
}

function formatCoachingBlock(coaching: ObservabilityCoachingContext): string {
  const hints =
    coaching.coachingHints.length > 0
      ? coaching.coachingHints.map((hint) => `- ${hint}`).join('\n')
      : '- (none)';
  const constraints =
    Object.keys(coaching.constraints).length > 0
      ? JSON.stringify(coaching.constraints, null, 2)
      : '{}';
  return [
    '',
    '## Coaching from prior edits',
    hints,
    '',
    'Constraints:',
    constraints,
  ].join('\n');
}

export function buildPlanEditSystemPrompt(
  coaching?: ObservabilityCoachingContext | null,
  projectIntent?: ObservabilityProjectIntent | null,
  resolvedReferences?: ImplicitReferenceRecord[] | null
): string {
  const blocks = [PLANNER_SYSTEM];
  const vocabulary = formatProjectVocabularyBlock(projectIntent);
  if (vocabulary) blocks.push(vocabulary);
  const resolved = formatResolvedReferencesBlock(resolvedReferences);
  if (resolved) blocks.push(resolved);
  if (coaching && coaching.coachingHints.length > 0) {
    blocks.push(formatCoachingBlock(coaching));
  }
  return blocks.join('');
}

export function buildPlanEditUserPrompt(editContext: EditContext, userPrompt: string): string {
  const { siteModel, target, sectionCatalog, riskFlags, verificationContract } = editContext;
  const structureMap =
    siteModel.structure != null
      ? formatStructureMap(siteModel.structure)
      : sectionCatalog.textBlock;

  const resolvedTarget =
    target.sectionIndex != null
      ? `Resolved section [${target.sectionIndex}] "${target.title ?? ''}" (${target.confidence})`
      : target.kind === 'hero'
        ? 'Resolved target: hero'
        : 'Target unresolved — clarify if needed';

  const sectionSummaries = editContext.sections
    .map(
      (s) =>
        `[${s.index}] type=${s.type} title="${s.title}" bg=${s.presentation?.backgroundClass ?? 'preset'}`
    )
    .join('\n');

  const snippetBlock =
    editContext.selectedSnippets.length > 0
      ? editContext.selectedSnippets
          .map((s) => `--- ${s.path} (${s.label}) ---\n${s.content.slice(0, 2000)}`)
          .join('\n\n')
      : '(no snippets)';

  const duplicateCopy = siteModel.siteConfigContent
    ? resolveDuplicateCopyTarget(siteModel.siteConfigContent, editContext.effectiveMessage)
    : null;
  const duplicateBlock =
    duplicateCopy && duplicateCopy.fields.length >= 2
      ? `Duplicate copy map (same text in multiple fields):\n${duplicateCopy.fields
          .map((f) => `- ${f.label}: "${f.value.slice(0, 80)}${f.value.length > 80 ? '…' : ''}"`)
          .join('\n')}\n`
      : '';

  const historyBlock = formatWeightedConversationForPrompt(
    editContext.conversationHistory,
    DEFAULT_EDIT_CONTEXT_TURNS
  );

  const galleryImageSections = editContext.sections.filter(
    (s) => s.type === 'gallery' && (s.itemCount ?? 0) > 0
  );
  const sectionCardDescriptionRequest = isSectionCardDescriptionRequest(
    editContext.effectiveMessage
  );
  const galleryHint =
    isGalleryDescriptionRequest(editContext.effectiveMessage) &&
    !sectionCardDescriptionRequest &&
    galleryImageSections.length > 0
      ? `Gallery context: owner likely means section [${galleryImageSections[0].index}] "${galleryImageSections[0].title}" (${galleryImageSections[0].itemCount} item(s)). Do not ask which images — add item descriptions in siteConfig.\n\n`
      : '';

  const pinnedSectionIndex = editContext.selectedTargetContext?.resolved.sectionIndex;
  const pinnedTitleOnlyItems =
    editContext.selectedTargetContext?.section?.items?.filter(
      (item) => !(typeof item.imageUrl === 'string' && item.imageUrl.includes('/uploads/'))
    ) ?? [];
  const sectionCardHint =
    sectionCardDescriptionRequest &&
    pinnedSectionIndex != null &&
    pinnedTitleOnlyItems.length > 0
      ? `Section card context: owner wants descriptions on title-only cards in pinned section [${pinnedSectionIndex}] "${editContext.selectedTargetContext?.resolved.sectionTitle ?? ''}". Use update_config_field on sections[${pinnedSectionIndex}].items[j].description for each card (keep titles unchanged).\n\n`
      : '';

  const pinnedTarget = editContext.selectedTargetContext
    ? `${formatSelectedTargetContextBlock(editContext.selectedTargetContext)}\n\n`
    : editContext.selectedTarget
      ? `UI-SELECTED TARGET (pinned): ${formatSelectedTargetForMessage(editContext.selectedTarget)}\n\n`
      : '';

  return `Business: ${siteModel.parsedConfig?.businessName ?? '(unknown)'}
Archetype: ${siteModel.archetype}
Risk: ${riskFlags.level} (${riskFlags.reasons.join('; ') || 'none'})

${duplicateBlock}${galleryHint}${sectionCardHint}${historyBlock}${pinnedTarget}${resolvedTarget}

Sections:
${sectionSummaries || '(none)'}

Structure map:
${structureMap}

Verification hints:
${JSON.stringify(verificationContract.checks)}

Context snippets:
${snippetBlock}

User request:
${(editContext.effectiveMessage || userPrompt).trim()}`;
}
