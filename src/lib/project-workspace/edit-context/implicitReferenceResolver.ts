import { parseSiteConfigSource } from '@/lib/site-manager/siteConfigParser';
import { isObservabilityCoachingEnabled } from '@/lib/observability/config';
import type { ObservabilityCoachingContext, ObservabilityProjectIntent } from '@/lib/observability/types';
import { getLLMClient } from '@/lib/project-workspace/planner/llmClient';
import type { ConversationTurn } from '@/lib/project-workspace/edit-shared/editAmbiguity';
import { TAILWIND_COLOR_NAMES } from '@/lib/project-workspace/edit-shared/preset/presetUtils';
import type { EditContext } from './types';
import {
  detectImplicitPhrases,
  type DetectedImplicitPhrase,
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

function searchColorFromIntent(intent: ObservabilityProjectIntent): string[] {
  return uniqueStrings(intent.keywords.flatMap((kw) => findColorsInText(kw)));
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

function searchCtaFromIntent(intent: ObservabilityProjectIntent): string[] {
  return uniqueStrings(
    intent.intents
      .filter((entry) => /\bcta\b/i.test(entry.label))
      .map((entry) => entry.label.replace(/\bcta\b/i, '').trim())
      .filter((label) => label.length >= 2)
  );
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
    if (projectIntent) {
      for (const color of searchColorFromIntent(projectIntent)) {
        candidates.push({
          value: color,
          source: 'project_intent',
          reason: `Project vocabulary keyword mentions "${color}"`,
        });
      }
    }
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

  if (kind === 'cta') {
    for (const cta of searchCtaFromHistory(history)) {
      candidates.push({
        value: cta,
        source: 'chat_history',
        reason: `Prior chat mentions CTA "${cta}"`,
      });
    }
    if (projectIntent) {
      for (const cta of searchCtaFromIntent(projectIntent)) {
        candidates.push({
          value: cta,
          source: 'project_intent',
          reason: `Project intent label references CTA`,
        });
      }
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

function sourceLabel(source: ImplicitReferenceSource): string {
  switch (source) {
    case 'project_intent':
      return 'project vocabulary';
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

  const intentBlock = input.projectIntent
    ? JSON.stringify({
        keywords: input.projectIntent.keywords.slice(0, 10),
        intents: input.projectIntent.intents.slice(0, 5),
        turn_count: input.projectIntent.turn_count,
      })
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
- Only resolve when evidence exists in project vocabulary, coaching, or chat history.
- Do not pick section targets.
- Do not override explicit user values in the message.
- If uncertain, set canResolve false and provide clarificationQuestion.`;

  const prompt = `Owner message: ${input.ownerMessage}
Implicit phrase to resolve: "${phrase}"
Expected kind: ${kind}

Project vocabulary:
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
  return Boolean(input.projectIntent || input.coachingContext || history.length > 0);
}

function mayUseLlmResolver(input: ResolveImplicitReferencesInput): boolean {
  if (!hasEvidenceContext(input)) return false;
  return (
    isObservabilityCoachingEnabled() ||
    Boolean(input.projectIntent || input.coachingContext)
  );
}

/**
 * Resolve vague value references using project vocabulary, coaching, history, and guarded LLM fallback.
 * Does not modify edit target — values only.
 */
export async function resolveImplicitReferences(
  input: ResolveImplicitReferencesInput
): Promise<ImplicitReferenceResolution> {
  const phrases = detectImplicitPhrases(input.ownerMessage);
  if (phrases.length === 0) {
    return { references: [] };
  }

  const references: ImplicitReferenceRecord[] = [];
  const unresolved: DetectedImplicitPhrase[] = [];

  for (const detected of phrases) {
    if (hasExplicitValueForKind(input.ownerMessage, detected.kind)) {
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

    const evidence = searchDeterministicEvidence(detected.kind, input);
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

/** True when any reference was resolved with a concrete value (for job logs). */
export function hasResolvedReferenceValues(references: ImplicitReferenceRecord[]): boolean {
  return references.some((r) => Boolean(r.resolvedValue?.trim()));
}
