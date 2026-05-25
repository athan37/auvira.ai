/** Phase 3 commerce configuration — Stripe checkout is not enabled yet. */
export const COMMERCE_PHASE = {
  catalog: 2,
  checkout: 3,
} as const;

export function isStripeCheckoutEnabled(): boolean {
  return process.env.STRIPE_CHECKOUT_ENABLED === 'true';
}

export function getStripeConfigHint(): string {
  return 'Set STRIPE_CHECKOUT_ENABLED=true and STRIPE_SECRET_KEY to enable online checkout (Phase 3).';
}
