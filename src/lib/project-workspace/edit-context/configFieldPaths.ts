/**
 * Allowlisted siteConfig field paths for safe selected-target edits.
 */

export interface ParsedConfigFieldPath {
  fieldPath: string;
  scope: 'hero' | 'businessName' | 'contact' | 'section' | 'sectionItem' | 'actionItem';
  sectionIndex?: number;
  itemIndex?: number;
  /** Index into contact.extraLines when field is `extraLines`. */
  contactExtraLineIndex?: number;
  field: string;
}

const FIELD_PATH_RE =
  /^(hero\.(headline|subheadline|tagline|primaryCta|secondaryCta)|businessName|contact\.(phone|email|address)|sections\[(\d+)\]\.(title|subtitle|body)|sections\[(\d+)\]\.items\[(\d+)\]\.(title|description|imageUrl|alt|label|href)|sections\[(\d+)\]\.actionItems\[(\d+)\]\.(name|description|valueLabel|ctaLabel))$/;

const CONTACT_EXTRA_LINE_RE = /^contact\.extraLines\[(\d+)\]$/;

/** Parse and validate an allowlisted config field path. */
export function parseConfigFieldPath(fieldPath: string): ParsedConfigFieldPath | null {
  const trimmed = fieldPath.trim();
  const extraLineMatch = trimmed.match(CONTACT_EXTRA_LINE_RE);
  if (extraLineMatch?.[1] != null) {
    return {
      fieldPath: trimmed,
      scope: 'contact',
      field: 'extraLines',
      contactExtraLineIndex: Number(extraLineMatch[1]),
    };
  }

  const match = trimmed.match(FIELD_PATH_RE);
  if (!match) return null;

  if (trimmed.startsWith('hero.')) {
    return { fieldPath: trimmed, scope: 'hero', field: match[2]! };
  }
  if (trimmed === 'businessName') {
    return { fieldPath: trimmed, scope: 'businessName', field: 'businessName' };
  }
  if (trimmed.startsWith('contact.')) {
    return { fieldPath: trimmed, scope: 'contact', field: match[3]! };
  }
  if (match[4] != null && match[6] == null) {
    const sectionIndex = Number(match[4]);
    return {
      fieldPath: trimmed,
      scope: 'section',
      sectionIndex,
      field: match[5]!,
    };
  }
  if (match[6] != null && match[7] != null && match[9] == null) {
    return {
      fieldPath: trimmed,
      scope: 'sectionItem',
      sectionIndex: Number(match[6]),
      itemIndex: Number(match[7]),
      field: match[8]!,
    };
  }
  if (match[9] != null && match[10] != null) {
    return {
      fieldPath: trimmed,
      scope: 'actionItem',
      sectionIndex: Number(match[9]),
      itemIndex: Number(match[10]),
      field: match[11]!,
    };
  }
  return null;
}

/** Read current value at allowlisted field path from parsed siteConfig object. */
export function readConfigFieldValue(
  config: Record<string, unknown>,
  parsed: ParsedConfigFieldPath
): unknown {
  if (parsed.scope === 'businessName') {
    return config.businessName;
  }
  if (parsed.scope === 'hero') {
    const hero = config.hero as Record<string, unknown> | undefined;
    return hero?.[parsed.field];
  }
  if (parsed.scope === 'contact') {
    const contact = config.contact as Record<string, unknown> | undefined;
    if (parsed.field === 'extraLines' && parsed.contactExtraLineIndex != null) {
      const extraLines = Array.isArray(contact?.extraLines)
        ? (contact!.extraLines as unknown[])
        : [];
      return extraLines[parsed.contactExtraLineIndex];
    }
    return contact?.[parsed.field];
  }
  const sections = Array.isArray(config.sections)
    ? (config.sections as Array<Record<string, unknown>>)
    : [];
  const section = sections[parsed.sectionIndex ?? -1];
  if (!section) return undefined;

  if (parsed.scope === 'section') {
    return section[parsed.field];
  }

  const items = Array.isArray(section.items)
    ? (section.items as Array<Record<string, unknown>>)
    : [];
  const item = items[parsed.itemIndex ?? -1];
  if (parsed.scope === 'sectionItem') {
    return item?.[parsed.field];
  }

  const actionItems = Array.isArray(section.actionItems)
    ? (section.actionItems as Array<Record<string, unknown>>)
    : [];
  const actionItem = actionItems[parsed.itemIndex ?? -1];
  return actionItem?.[parsed.field];
}

/** Build canonical field path strings. */
export function sectionFieldPath(sectionIndex: number, field: string): string {
  return `sections[${sectionIndex}].${field}`;
}

export function sectionItemFieldPath(
  sectionIndex: number,
  itemIndex: number,
  field: string
): string {
  return `sections[${sectionIndex}].items[${itemIndex}].${field}`;
}

export function actionItemFieldPath(
  sectionIndex: number,
  itemIndex: number,
  field: string
): string {
  return `sections[${sectionIndex}].actionItems[${itemIndex}].${field}`;
}

export function heroFieldPath(field: string): string {
  return `hero.${field}`;
}

/** Build canonical contact.extraLines[n] path. */
export function contactExtraLineFieldPath(index: number): string {
  return `contact.extraLines[${index}]`;
}
