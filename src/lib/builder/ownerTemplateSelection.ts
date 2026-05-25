/** Reason stored when the owner picks a theme in the UI (clone start or review). */
export const OWNER_TEMPLATE_REASON = 'Chosen by owner';

export function isOwnerChosenTemplate(reason?: string): boolean {
  return reason === OWNER_TEMPLATE_REASON || reason === 'Chosen at start' || reason === 'Selected by owner';
}
