import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { isObservabilityCoachingEnabled } from '@/lib/observability/config';
import {
  evidenceFromIntentSentence,
  hasUsableIntentSentence,
  intentSentenceIsUnresolved,
} from '@/lib/observability/intentSentence';
import type {
  ObservabilityCoachingContext,
  ObservabilityProjectIntent,
} from '@/lib/observability/types';
import { getLLMClient } from '@/lib/project-workspace/planner/llmClient';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/editAmbiguity';
import { TAILWIND_COLOR_NAMES } from '@/lib/project-workspace/edit-shared/preset/presetUtils';
import type { EditContext } from './types';
import {
  collectImplicitPhrases,
  type ExtractedImplicitRef,
} from './extractImplicitReferences';
import {
  extractExplicitColorValue,
  extractExplicitQuotedValue,
  hasExplicitValueForKind,
} from './implicitReferencePhrases';
import type {
  ImplicitReferenceKind,
  ImplicitReferenceRecord,
  ImplicitReferenceResolution,
  ImplicitReferenceSource,
} from './implicitReferenceTypes';

const LLM_RESOLVER_SCHEMA = {
  type: 'object',
  properties: {
    canResolve: { type: 'boolean' },
    resolvedPhrase: { type: 'string' },
    resolvedValue: { type: ['string', 'null'] },
    resolvedKind: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reason: { type: 'string' },
    clarificationQuestion: { type: ['string', 'null'] },
    suggestedReplies: { type: 'array', items: { type: 'string' } },
  },
  required: ['canResolve', 'resolvedPhrase', 'confidence', 'reason'],
};

export interface ResolveImplicitReferencesInput {
  ownerMessage: string;
  editContext: EditContext;
  coachingContext?: ObservabilityCoachingContext | null;
  projectIntent?: ObservabilityProjectIntent | null;
  recentHistory?: ConversationTurn[];
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function findColorsInText(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const name of TAILWIND_COLOR_NAMES) {
    if (lower.includes(name)) found.push(name);
  }
  const hex = text.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g);
  if (hex) found.push(...hex);
  const favorite = text.match(/favorite\s+colou?r\s*(?:is|=|:)?\s*([a-z#]+)/i);
  if (favorite?.[1]) found.push(favorite[1]);
  return uniqueStrings(found);
}

function evidenceFromProjectIntentSentence(
  intent: ObservabilityProjectIntent | null | undefined,
  kind: ImplicitReferenceKind
): EvidenceCandidate[] {
  const sentence = intent?.sentence?.trim();
  if (!sentence) return [];
  const mapped = evidenceFromIntentSentence(sentence, kind);
  if (!mapped) return [];
  return [
    {
      value: mapped.value,
      source: 'project_intent',
      reason: mapped.reason,
    },
  ];
}

const FAVORITE_COLOR_PHRASE_PATTERN =
  /\b(?:my\s+)?(?:favorite|favourite|faviorite|faviourite)\s+colou?r\b/i;

function isFavoriteColorPhrase(phrase: string): boolean {
  return FAVORITE_COLOR_PHRASE_PATTERN.test(phrase);
}

function isColorClarificationAssistantTurn(turn: ConversationTurn): boolean {
  if (turn.role !== 'assistant') return false;
  return (
    /What color should I use/i.test(turn.content) ||
    Boolean(
      (turn.metadata as { pendingImplicitRef?: { kind?: string } } | undefined)?.pendingImplicitRef
        ?.kind === 'color'
    )
  );
}

/** Most recent owner color answer after a favorite-color clarify thread. */
function searchFavoriteColorFromClarificationThread(
  history: ConversationTurn[]
): EvidenceCandidate[] {
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (!isColorClarificationAssistantTurn(turn)) continue;
    const answerTurn = history[i + 1];
    if (answerTurn?.role !== 'user') continue;
    const color =
      extractExplicitColorValue(answerTurn.content) ??
      findColorsInText(answerTurn.content)[0] ??
      null;
    if (!color) continue;
    return [
      {
        value: color,
        source: 'chat_history',
        reason: 'Owner answered a prior color clarification in chat',
      },
    ];
  }
  return [];
}

/** Explicit statements like "my favorite color is green" in prior chat. */
function searchFavoriteColorExplicitInChat(
  history: ConversationTurn[]
): EvidenceCandidate[] {
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    const content = turn.content;
    const match = content.match(
      /\b(?:my\s+)?(?:favorite|favourite|faviorite|faviourite)\s+colou?r\s*(?:is|=|:)\s*([a-z#][a-z0-9#-]*)/i
    );
    if (match?.[1]) {
      return [
        {
          value: match[1].toLowerCase(),
          source: 'chat_history',
          reason: 'Owner stated favorite color explicitly in chat',
        },
      ];
    }
  }
  return [];
}

function searchFavoriteColorFromHistoryMetadata(
  history: ConversationTurn[]
): EvidenceCandidate[] {
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn.role !== 'assistant') continue;
    const meta = turn.metadata as
      | {
          resolvedReferences?: Array<{ phrase?: string; resolvedValue?: string }>;
          appliedProjectMemory?: Array<{ phrase?: string; resolvedValue?: string }>;
        }
      | undefined;
    const refs = meta?.resolvedReferences ?? meta?.appliedProjectMemory ?? [];
    for (const ref of refs) {
      if (!ref.phrase?.trim() || !ref.resolvedValue?.trim()) continue;
      if (!isFavoriteColorPhrase(ref.phrase)) continue;
      return [
        {
          value: ref.resolvedValue.trim(),
          source: 'chat_history',
          reason: `Most recent prior edit resolved "${ref.phrase}"`,
        },
      ];
    }
  }
  return [];
}

function gatherPhraseBoundFavoriteColorEvidence(
  detected: ExtractedImplicitRef,
  input: ResolveImplicitReferencesInput
): EvidenceCandidate[] {
  if (detected.kind !== 'color' || !isFavoriteColorPhrase(detected.phrase)) {
    return [];
  }
  const history = input.recentHistory ?? input.editContext.conversationHistory ?? [];

  const sources = [
    evidenceFromProjectIntentSentence(input.projectIntent, 'color'),
    searchFavoriteColorFromHistoryMetadata(history),
    searchFavoriteColorFromClarificationThread(history),
    searchFavoriteColorExplicitInChat(history),
  ];

  for (const candidates of sources) {
    if (candidates.length === 1) {
      return candidates;
    }
  }

  if (input.projectIntent?.sentence && intentSentenceIsUnresolved(input.projectIntent.sentence)) {
    return [];
  }

  return [];
}

function searchColorFromCoaching(coaching: ObservabilityCoachingContext): string[] {
  const lines = [...coaching.coachingHints, ...coaching.recurringIssues];
  return uniqueStrings(lines.flatMap((line) => findColorsInText(line)));
}

function searchColorFromHistory(history: ConversationTurn[]): string[] {
  const lines = history.map((t) => t.content);
  return uniqueStrings(lines.flatMap((line) => findColorsInText(line)));
}

function searchCtaFromHistory(history: ConversationTurn[]): string[] {
  const candidates: string[] = [];
  for (const turn of history) {
    const quoted = turn.content.match(/["']([^"']{2,60})["']/g);
    if (quoted) {
      for (const q of quoted) {
        const inner = q.slice(1, -1).trim();
        if (inner.length >= 2) candidates.push(inner);
      }
    }
    const ctaMatch = turn.content.match(
      /\b(?:CTA|button(?:\s+text)?)\s+(?:to|as|is)\s+["']?([^"'\n.]{2,60})/i
    );
    if (ctaMatch?.[1]) candidates.push(ctaMatch[1].trim());
    const bookNow = turn.content.match(/\bBook Now\b/i);
    if (bookNow) candidates.push('Book Now');
  }
  return uniqueStrings(candidates);
}

function readHeroPresentation(editContext: EditContext): string | null {
  const heroFromSections = editContext.sections.find((s) => s.type === 'hero');
  const sectionBg = heroFromSections?.presentation?.backgroundClass;
  if (typeof sectionBg === 'string' && sectionBg.trim()) return sectionBg.trim();

  const content = editContext.siteModel.siteConfigContent;
  if (!content) return null;
  const parsed = parseSiteConfigSource(content);
  const heroSection = parsed?.sections?.find((s) => s.type === 'hero') as
    | { presentation?: { backgroundClass?: string } }
    | undefined;
  const bgClass = heroSection?.presentation?.backgroundClass;
  return typeof bgClass === 'string' && bgClass.trim() ? bgClass.trim() : null;
}

interface EvidenceCandidate {
  value: string;
  source: ImplicitReferenceSource;
  reason: string;
}

function pickSingleCandidate(candidates: EvidenceCandidate[]): EvidenceCandidate | null {
  const unique = uniqueStrings(candidates.map((c) => c.value));
  if (unique.length === 1 && candidates.length > 0) {
    return candidates.find((c) => c.value.toLowerCase() === unique[0]!.toLowerCase()) ?? candidates[0]!;
  }
  return null;
}

function searchDeterministicEvidence(
  kind: ImplicitReferenceKind,
  input: ResolveImplicitReferencesInput
): EvidenceCandidate[] {
  const { projectIntent, coachingContext, recentHistory, editContext } = input;
  const history = recentHistory ?? editContext.conversationHistory ?? [];
  const candidates: EvidenceCandidate[] = [];

  if (kind === 'color') {
    candidates.push(...evidenceFromProjectIntentSentence(projectIntent, 'color'));
    if (coachingContext) {
      for (const color of searchColorFromCoaching(coachingContext)) {
        candidates.push({
          value: color,
          source: 'coaching_context',
          reason: `Coaching hint mentions "${color}"`,
        });
      }
    }
    for (const color of searchColorFromHistory(history)) {
      candidates.push({
        value: color,
        source: 'chat_history',
        reason: `Prior chat mentions "${color}"`,
      });
    }
  }

  if (kind === 'copy') {
    candidates.push(...evidenceFromProjectIntentSentence(projectIntent, 'copy'));
  }

  if (kind === 'cta') {
    candidates.push(...evidenceFromProjectIntentSentence(projectIntent, 'cta'));
    for (const cta of searchCtaFromHistory(history)) {
      candidates.push({
        value: cta,
        source: 'chat_history',
        reason: `Prior chat mentions CTA "${cta}"`,
      });
    }
  }

  if (kind === 'style') {
    const heroStyle = readHeroPresentation(editContext);
    if (heroStyle) {
      candidates.push({
        value: heroStyle,
        source: 'chat_history',
        reason: 'Hero section has concrete presentation.backgroundClass',
      });
    }
  }

  return candidates;
}

function resolveKindForExplicitCheck(kind: ImplicitReferenceKind): ImplicitReferenceKind {
  if (kind === 'edit_pattern') return 'unknown';
  return kind;
}

function sourceLabel(source: ImplicitReferenceSource): string {
  switch (source) {
    case 'project_intent':
      return 'Project Memory';
    case 'project_memory':
      return 'Project Memory';
    case 'coaching_context':
      return 'coaching context';
    case 'chat_history':
      return 'project history';
    case 'llm_inference':
      return 'context inference';
    case 'explicit_message':
      return 'explicit message';
    default:
      return source;
  }
}

function buildResolvedMessage(
  ownerMessage: string,
  references: ImplicitReferenceRecord[]
): string {
  const resolved = references.filter((r) => r.resolvedValue);
  if (resolved.length === 0) return ownerMessage;
  const notes = resolved
    .map((r) => `${r.phrase}=${r.resolvedValue}`)
    .join('; ');
  return `${ownerMessage.trim()} [Resolved references: ${notes}]`;
}

function clarificationForKind(kind: ImplicitReferenceKind, phrase: string): string {
  if (kind === 'color') return 'What color should I use?';
  if (kind === 'cta') return 'What CTA text should I use?';
  if (kind === 'style') return `Which style from "${phrase}" should I copy?`;
  if (kind === 'offer') return 'Which service or offer should I use?';
  if (kind === 'edit_pattern') {
    return `What kind of edit do you mean by "${phrase}" — background, text, copy, or something else?`;
  }
  return `Can you clarify what you mean by "${phrase}"?`;
}

async function resolveWithLlm(
  input: ResolveImplicitReferencesInput,
  phrase: string,
  kind: ImplicitReferenceKind
): Promise<ImplicitReferenceRecord | { needsClarification: true; message: string; suggestedReplies?: string[] } | null> {
  const llm = getLLMClient();
  const history = (input.recentHistory ?? input.editContext.conversationHistory ?? [])
    .slice(-6)
    .map((t) => `${t.role}: ${t.content}`)
    .join('\n');

  const intentBlock = input.projectIntent?.sentence?.trim()
    ? JSON.stringify({ intent: input.projectIntent.sentence.trim() })
    : '{}';

  const coachingBlock = input.coachingContext
    ? JSON.stringify({
        hints: input.coachingContext.coachingHints.slice(0, 8),
        recurringIssues: input.coachingContext.recurringIssues,
      })
    : '{}';

  const system = `You resolve implicit references in website edit requests.
Rules:
- Do not invent preferences or guess favorite colors from generic keywords.
- Only resolve when evidence exists in project intent, coaching, or chat history.
- Do not pick section targets.
- Do not override explicit user values in the message.
- If uncertain, set canResolve false and provide clarificationQuestion.`;

  const prompt = `Owner message: ${input.ownerMessage}
Implicit phrase to resolve: "${phrase}"
Expected kind: ${kind}

Project intent:
${intentBlock}

Coaching:
${coachingBlock}

Recent chat:
${history || '(none)'}

Return structured JSON.`;

  const result = await llm.generateJSON<{
    canResolve?: boolean;
    resolvedPhrase?: string;
    resolvedValue?: string | null;
    resolvedKind?: string;
    confidence?: string;
    reason?: string;
    clarificationQuestion?: string | null;
    suggestedReplies?: string[];
  }>({
    system,
    prompt,
    schema: LLM_RESOLVER_SCHEMA,
    maxTokens: 512,
    temperature: 0,
  });

  if (!result.ok || !result.data) return null;

  const data = result.data;
  if (
    data.canResolve &&
    data.confidence === 'high' &&
    typeof data.resolvedValue === 'string' &&
    data.resolvedValue.trim()
  ) {
    return {
      phrase,
      resolvedValue: data.resolvedValue.trim(),
      resolvedKind: (data.resolvedKind as ImplicitReferenceKind) ?? kind,
      source: 'llm_inference',
      confidence: 'high',
      reason: data.reason ?? 'LLM resolved from provided evidence',
    };
  }

  if (data.clarificationQuestion) {
    return {
      needsClarification: true,
      message: data.clarificationQuestion,
      suggestedReplies: data.suggestedReplies,
    };
  }

  return null;
}

function hasEvidenceContext(input: ResolveImplicitReferencesInput): boolean {
  const history = input.recentHistory ?? input.editContext.conversationHistory ?? [];
  return Boolean(
    hasUsableIntentSentence(input.projectIntent?.sentence) ||
      input.coachingContext ||
      history.length > 0
  );
}

function mayUseLlmResolver(input: ResolveImplicitReferencesInput): boolean {
  if (!hasEvidenceContext(input)) return false;
  return (
    isObservabilityCoachingEnabled() ||
    Boolean(
      hasUsableIntentSentence(input.projectIntent?.sentence) ||
        input.coachingContext
    )
  );
}

function gatherEvidence(
  detected: ExtractedImplicitRef,
  input: ResolveImplicitReferencesInput
): EvidenceCandidate[] {
  return searchDeterministicEvidence(detected.kind, input);
}

function findPendingImplicitRefFromHistory(
  history: ConversationTurn[]
): { phrase: string; kind: ImplicitReferenceKind } | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn.role !== 'assistant') continue;
    const pending = (
      turn.metadata as { pendingImplicitRef?: { phrase?: string; kind?: ImplicitReferenceKind } } | undefined
    )?.pendingImplicitRef;
    if (pending?.phrase && pending.kind) {
      return { phrase: pending.phrase, kind: pending.kind };
    }
  }
  return null;
}

function resolvePendingImplicitFromHistory(
  input: ResolveImplicitReferencesInput
): ImplicitReferenceResolution | null {
  const history = input.recentHistory ?? input.editContext.conversationHistory ?? [];
  const pending = findPendingImplicitRefFromHistory(history);
  if (!pending) return null;

  if (pending.kind === 'color') {
    const explicitColor = extractExplicitColorValue(input.ownerMessage);
    if (!explicitColor) return null;
    const record: ImplicitReferenceRecord = {
      phrase: pending.phrase,
      resolvedValue: explicitColor,
      resolvedKind: 'color',
      source: 'explicit_message',
      confidence: 'high',
      reason: 'Owner answered pending color clarification',
    };
    return {
      references: [record],
      resolvedMessage: buildResolvedMessage(input.ownerMessage, [record]),
    };
  }

  return null;
}

/**
 * Resolve vague value references using project memory, vocabulary, coaching, history, and guarded LLM fallback.
 * Does not modify edit target — values only.
 */
export async function resolveImplicitReferences(
  input: ResolveImplicitReferencesInput
): Promise<ImplicitReferenceResolution> {
  const pendingResolution = resolvePendingImplicitFromHistory(input);
  if (pendingResolution) {
    return pendingResolution;
  }

  const { refs: phrases } = await collectImplicitPhrases(input.ownerMessage);
  if (phrases.length === 0) {
    return { references: [] };
  }

  const references: ImplicitReferenceRecord[] = [];
  const unresolved: ExtractedImplicitRef[] = [];

  for (const detected of phrases) {
    const explicitKind = resolveKindForExplicitCheck(detected.kind);
    if (hasExplicitValueForKind(input.ownerMessage, explicitKind)) {
      const explicitColor = detected.kind === 'color' ? extractExplicitColorValue(input.ownerMessage) : null;
      const explicitQuote =
        detected.kind === 'cta' || detected.kind === 'copy'
          ? extractExplicitQuotedValue(input.ownerMessage)
          : null;
      const explicitValue = explicitColor ?? explicitQuote ?? undefined;
      references.push({
        phrase: detected.phrase,
        resolvedValue: explicitValue,
        resolvedKind: detected.kind,
        source: 'explicit_message',
        confidence: 'high',
        reason: 'Explicit value in owner message wins over context',
      });
      continue;
    }

    if (detected.kind === 'color' && isFavoriteColorPhrase(detected.phrase)) {
      const phraseBound = gatherPhraseBoundFavoriteColorEvidence(detected, input);
      const phrasePicked = pickSingleCandidate(phraseBound);
      if (phrasePicked) {
        references.push({
          phrase: detected.phrase,
          resolvedValue: phrasePicked.value,
          resolvedKind: detected.kind,
          source: phrasePicked.source,
          confidence: 'high',
          reason: phrasePicked.reason,
        });
        continue;
      }
      if (phraseBound.length > 1) {
        return {
          references,
          needsClarification: true,
          clarificationMessage: clarificationForKind(detected.kind, detected.phrase),
          suggestedReplies: uniqueStrings(phraseBound.map((e) => e.value)).slice(0, 4),
        };
      }
    }

    const evidence = gatherEvidence(detected, input);
    const picked = pickSingleCandidate(evidence);
    if (picked) {
      references.push({
        phrase: detected.phrase,
        resolvedValue: picked.value,
        resolvedKind: detected.kind,
        source: picked.source,
        confidence: 'high',
        reason: picked.reason,
      });
      continue;
    }

    if (evidence.length > 1) {
      return {
        references,
        needsClarification: true,
        clarificationMessage: clarificationForKind(detected.kind, detected.phrase),
        suggestedReplies: uniqueStrings(evidence.map((e) => e.value)).slice(0, 4),
      };
    }

    unresolved.push(detected);
  }

  for (const detected of unresolved) {
    if (mayUseLlmResolver(input)) {
      const llmResult = await resolveWithLlm(input, detected.phrase, detected.kind);
      if (llmResult && 'needsClarification' in llmResult) {
        return {
          references,
          needsClarification: true,
          clarificationMessage: llmResult.message,
          suggestedReplies: llmResult.suggestedReplies,
        };
      }
      if (llmResult && 'phrase' in llmResult) {
        references.push(llmResult);
        continue;
      }
    }

    return {
      references,
      needsClarification: true,
      clarificationMessage: clarificationForKind(detected.kind, detected.phrase),
      suggestedReplies: detected.kind === 'color' ? ['Blue', 'Green', 'Red'] : undefined,
    };
  }

  const resolvedMessage = buildResolvedMessage(input.ownerMessage, references);
  return {
    references,
    resolvedMessage: references.some((r) => r.resolvedValue) ? resolvedMessage : undefined,
  };
}

/** Format source label for planner prompt blocks. */
export function formatReferenceSourceLabel(source: ImplicitReferenceSource): string {
  return sourceLabel(source);
}

export { hasResolvedReferenceValues } from './implicitReferenceTypes';
