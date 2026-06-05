/** Title-case section type for badges (contact → Contact). */
export function sectionTypeLabel(sectionType: string | undefined): string {
  const raw = sectionType?.trim();
  if (!raw) return 'Section';
  if (raw.toLowerCase() === 'hero') return 'Hero';
  if (raw.toLowerCase() === 'cta') return 'CTA';
  if (raw.toLowerCase() === 'faq') return 'FAQ';
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

export type ElementKindIconName =
  | 'button'
  | 'heading'
  | 'contact_field'
  | 'item_title'
  | 'item_body'
  | 'container'
  | 'item'
  | 'default';

/** Map bridge elementKind to icon variant for target card UI. */
export function elementKindIconName(elementKind: string | undefined): ElementKindIconName {
  const kind = elementKind?.trim().toLowerCase();
  switch (kind) {
    case 'button':
      return 'button';
    case 'heading':
      return 'heading';
    case 'contact_field':
      return 'contact_field';
    case 'item_title':
    case 'item_card':
    case 'image_caption':
      return 'item_title';
    case 'item_body':
    case 'body':
      return 'item_body';
    case 'item_grid':
    case 'inner_card':
    case 'panel':
      return 'container';
    case 'item':
      return 'item';
    default:
      return 'default';
  }
}

/** Icon for hierarchical chain row (role + kind). */
export function chainNodeIconName(
  role: 'section' | 'container' | 'item' | 'element',
  kind?: string
): ElementKindIconName {
  if (role === 'container') return 'container';
  if (role === 'item') return 'item';
  return elementKindIconName(kind);
}
