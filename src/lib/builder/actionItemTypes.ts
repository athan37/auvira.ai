/** Action types for category-based action modules (quote, buy, donate, etc.). */
export type ActionType = 'quote' | 'book' | 'buy' | 'donate' | 'rsvp' | 'contact';

/** Discriminator for action section modules (service packages, menu, tiers, etc.). */
export type ActionModuleKind =
  | 'service_packages'
  | 'menu_items'
  | 'donation_tiers'
  | 'event_rsvp'
  | 'portfolio_ctas';

/** Flexible action card stored on actions sections in siteConfig. */
export interface ActionItem {
  id: string;
  name: string;
  description?: string;
  valueLabel?: string;
  imageUrl?: string;
  ctaLabel?: string;
  actionType: ActionType;
}

export const ACTION_TYPE_CTA_DEFAULTS: Record<ActionType, string> = {
  quote: 'Request Quote',
  book: 'Book Now',
  buy: 'Add to Cart',
  donate: 'Donate Now',
  rsvp: 'RSVP',
  contact: 'Get in Touch',
};

export const ACTION_TYPE_CONFIRM_MESSAGES: Record<ActionType, string> = {
  quote: "Request submitted — we'll be in touch soon.",
  book: 'Booking request received.',
  buy: "Order received — we'll confirm shortly.",
  donate: 'Thank you for supporting our cause!',
  rsvp: "You're on the list — see you there!",
  contact: 'Message sent — thanks for reaching out.',
};

export const ACTION_MODULE_EYEBROWS: Record<ActionModuleKind, string> = {
  service_packages: 'Our Services',
  menu_items: 'Menu',
  donation_tiers: 'Support Us',
  event_rsvp: 'Events',
  portfolio_ctas: 'Featured Work',
};

export const ACTION_MODULE_EMPTY_HINTS: Record<ActionModuleKind, string> = {
  service_packages: 'Try: "Add a service package"',
  menu_items: 'Try: "Add menu items"',
  donation_tiers: 'Try: "Add a donation tier"',
  event_rsvp: 'Try: "Add an RSVP section"',
  portfolio_ctas: 'Try: "Add a portfolio item"',
};

/** Slugify for stable action item ids. */
export function slugifyActionId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
}

/** Create an action item with safe defaults. */
export function createActionItem(
  partial: Partial<ActionItem> & Pick<ActionItem, 'name' | 'actionType'>
): ActionItem {
  const baseId = slugifyActionId(partial.name) || 'item';
  return {
    id: partial.id ?? `${baseId}-${Math.random().toString(36).slice(2, 7)}`,
    name: partial.name,
    description: partial.description,
    valueLabel: partial.valueLabel,
    imageUrl: partial.imageUrl,
    ctaLabel: partial.ctaLabel ?? defaultCtaForActionType(partial.actionType),
    actionType: partial.actionType,
  };
}

/** Default CTA label for an action type. */
export function defaultCtaForActionType(type: ActionType): string {
  return ACTION_TYPE_CTA_DEFAULTS[type];
}

/** Mock confirmation copy when a visitor clicks an action CTA. */
export function confirmMessageForActionType(type: ActionType): string {
  return ACTION_TYPE_CONFIRM_MESSAGES[type];
}

/** Eyebrow label for an action module kind. */
export function eyebrowForModuleKind(kind: ActionModuleKind): string {
  return ACTION_MODULE_EYEBROWS[kind];
}

/** Empty-state hint for chat demos. */
export function emptyHintForModuleKind(kind: ActionModuleKind): string {
  return ACTION_MODULE_EMPTY_HINTS[kind];
}
