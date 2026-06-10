import { getLLMClient } from '@/lib/project-workspace/planner/llmClient';
import type { ImplicitReferenceKind } from './implicitReferenceTypes';
import {
  detectImplicitPhrases,
  type DetectedImplicitPhrase,
} from './implicitReferencePhrases';

export type ImplicitScopeHint = 'project' | 'this_section' | 'this_field' | 'hero';

export interface ExtractedImplicitRef {
  phrase: string;
  kind: ImplicitReferenceKind;
  scopeHint?: ImplicitScopeHint;
}

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    references: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          phrase: { type: 'string' },
          kind: {
            type: 'string',
            enum: [
              'color',
              'style',
              'copy',
              'cta',
              'offer',
              'edit_pattern',
              'unknown',
            ],
          },
          scopeHint: {
            type: 'string',
            enum: ['project', 'this_section', 'this_field', 'hero'],
          },
        },
        required: ['phrase', 'kind'],
      },
    },
  },
  required: ['references'],
};

const DEICTIC_GATE =
  /\b(favorite|favourite|faviorite|faviourite|usual|normal|typical|same\s+as|like\s+last|my\s+way|brand|default|custom(?:ary)?)\b/i;

/** Cheap gate before LLM extract — skip fully explicit messages. */
export function shouldExtractImplicitRefs(message: string): boolean {
  if (detectImplicitPhrases(message).length > 0) return true;
  return DEICTIC_GATE.test(message);
}

function toDetected(ref: ExtractedImplicitRef): DetectedImplicitPhrase {
  return {
    phrase: ref.phrase,
    kind: ref.kind === 'edit_pattern' ? 'unknown' : ref.kind,
    pattern: /.*/,
  };
}

/** Merge regex fast-path hits with LLM-extracted deictic references (deduped by phrase). */
export async function collectImplicitPhrases(
  message: string
): Promise<{ refs: ExtractedImplicitRef[]; fromLlm: boolean }> {
  const regexHits = detectImplicitPhrases(message).map((hit) => ({
    phrase: hit.phrase,
    kind: hit.kind,
  }));

  if (!shouldExtractImplicitRefs(message)) {
    return { refs: regexHits, fromLlm: false };
  }

  // Regex fast-path: skip LLM when known implicit phrases already matched
  if (regexHits.length > 0) {
    return { refs: regexHits, fromLlm: false };
  }

  const llmRefs = await extractImplicitReferencesFromMessage(message);
  const seen = new Set<string>();
  const merged: ExtractedImplicitRef[] = [];

  for (const ref of [...regexHits, ...llmRefs]) {
    const key = ref.phrase.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(ref);
  }

  return { refs: merged, fromLlm: llmRefs.length > 0 };
}

/** LLM structured extract for generic deictic preferences (values not invented). */
export async function extractImplicitReferencesFromMessage(
  message: string
): Promise<ExtractedImplicitRef[]> {
  const llm = getLLMClient();

  const system = `You extract implicit/deictic preference phrases from website edit requests.
Rules:
- Extract phrases like "my favorite color", "usual CTA", "my favorite way to edit", "same as last time".
- Classify each phrase kind: color, style, copy, cta, offer, edit_pattern, or unknown.
- scopeHint: project (site-wide), this_section, this_field, or hero when the message implies it.
- Do NOT invent values. Do NOT pick section indices or field paths.
- Return empty references when the message is fully explicit (e.g. "make it red", "change title to Hello").
- phrase must be a substring of the owner message.`;

  const result = await llm.generateJSON<{ references?: ExtractedImplicitRef[] }>({
    system,
    prompt: `Owner message:\n${message}`,
    schema: EXTRACT_SCHEMA,
    maxTokens: 512,
    temperature: 0,
  });

  if (!result.ok || !result.data?.references?.length) return [];

  return result.data.references
    .filter(
      (ref) =>
        typeof ref.phrase === 'string' &&
        ref.phrase.trim().length > 0 &&
        message.toLowerCase().includes(ref.phrase.toLowerCase())
    )
    .map((ref) => ({
      phrase: ref.phrase.trim(),
      kind: (ref.kind as ImplicitReferenceKind) ?? 'unknown',
      scopeHint: ref.scopeHint,
    }));
}

/** Maps extract output to legacy DetectedImplicitPhrase for resolver loops. */
export function extractedToDetected(refs: ExtractedImplicitRef[]): DetectedImplicitPhrase[] {
  return refs.map(toDetected);
}
