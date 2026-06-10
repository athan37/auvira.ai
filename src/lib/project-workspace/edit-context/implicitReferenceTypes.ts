/** Resolved implicit reference metadata attached to EditContext after resolution. */

export type ImplicitReferenceKind =
  | 'color'
  | 'style'
  | 'copy'
  | 'cta'
  | 'section_reference'
  | 'offer'
  | 'edit_pattern'
  | 'unknown';

export type ImplicitReferenceSource =
  | 'explicit_message'
  | 'project_intent'
  | 'project_memory'
  | 'coaching_context'
  | 'chat_history'
  | 'llm_inference';

export type ImplicitReferenceConfidence = 'high' | 'medium' | 'low';

export interface ImplicitReferenceRecord {
  phrase: string;
  resolvedValue?: string;
  resolvedKind: ImplicitReferenceKind;
  source: ImplicitReferenceSource;
  confidence: ImplicitReferenceConfidence;
  reason: string;
}

export interface ImplicitReferenceResolution {
  resolvedMessage?: string;
  references: ImplicitReferenceRecord[];
  needsClarification?: boolean;
  clarificationMessage?: string;
  suggestedReplies?: string[];
}

/** True when any reference was resolved with a concrete value. */
export function hasResolvedReferenceValues(references: ImplicitReferenceRecord[]): boolean {
  return references.some((r) => Boolean(r.resolvedValue?.trim()));
}
