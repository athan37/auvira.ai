const CONTACT_FIELDS = ['phone', 'email', 'address'] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];

function isContactField(value: unknown): value is ContactField {
  return typeof value === 'string' && CONTACT_FIELDS.includes(value as ContactField);
}

function messageMentionsContactField(message: string): ContactField | undefined {
  if (/\bphone\b/i.test(message)) return 'phone';
  if (/\bemail\b/i.test(message)) return 'email';
  if (/\baddress\b/i.test(message)) return 'address';
  return undefined;
}

/**
 * Resolve which siteConfig.contact field an update_contact step should mutate.
 * Keeps planner verification and domain tool execution aligned.
 */
export function resolveContactUpdateField(
  merged: Record<string, unknown>,
  message?: string
): ContactField {
  if (isContactField(merged.field)) {
    return merged.field;
  }

  const fromMessage = message ? messageMentionsContactField(message) : undefined;
  if (fromMessage) return fromMessage;

  const value = String(merged.value ?? '').trim();
  if (value) {
    const fieldsMatchingValue = CONTACT_FIELDS.filter(
      (field) => String(merged[field] ?? '').trim() === value
    );
    if (fieldsMatchingValue.length === 1) {
      return fieldsMatchingValue[0];
    }
    if (fromMessage) return fromMessage;
    return 'phone';
  }

  const paramFields = CONTACT_FIELDS.filter((field) => String(merged[field] ?? '').trim());
  if (paramFields.length === 1) {
    return paramFields[0];
  }

  return 'phone';
}

/** Resolve the new contact value for update_contact. */
export function resolveContactUpdateValue(
  merged: Record<string, unknown>,
  field: ContactField
): string {
  return String(merged.value ?? merged[field] ?? merged.phone ?? merged.email ?? '').trim();
}
