import type { TemplateCategory, TemplateVariant } from '../builder/themePresets';

export interface TemplateSelection {
  category: TemplateCategory;
  variant: TemplateVariant;
  reason: string;
}

/**
 * Deterministic template selector — no LLM needed.
 * Selects template based on business industry keywords.
 */
export function selectTemplateAgent(
  businessProfile: { industry?: string; businessName?: string; services?: string[] },
  _siteSpec?: unknown,
  _mode: 'clone' | 'scratch' = 'clone'
): TemplateSelection {
  const industry = (businessProfile.industry || '').toLowerCase();
  const name = (businessProfile.businessName || '').toLowerCase();
  const services = (businessProfile.services || []).map(s => s.toLowerCase()).join(' ');
  const combined = industry + ' ' + name + ' ' + services;

  // Legal / attorney
  if (combined.includes('law') || combined.includes('attorney') || combined.includes('legal') ||
      combined.includes('divorce') || combined.includes('custody') || combined.includes('paralegal') ||
      combined.includes('lawyer') || combined.includes('litigation') || combined.includes('counsel')) {
    return {
      category: 'legal',
      variant: 'premium-professional',
      reason: 'Legal/attorney business detected — premium professional template selected.',
    };
  }

  // Home services: HVAC, roofing, plumbing, electrical, inspection, contractor
  if (combined.includes('hvac') || combined.includes('roof') || combined.includes('plumb') ||
      combined.includes('electric') || combined.includes('inspect') || combined.includes('contractor') ||
      combined.includes('heating') || combined.includes('cooling') || combined.includes('air condition') ||
      combined.includes('garage door') || combined.includes('paving') || combined.includes('landscap')) {
    return {
      category: 'home-services',
      variant: 'local-service-pro',
      reason: 'Home services business detected — local service pro template selected.',
    };
  }

  // Healthcare: dental, chiropractic, clinic, therapy, wellness
  if (combined.includes('dental') || combined.includes('chiro') || combined.includes('clinic') ||
      combined.includes('therap') || combined.includes('wellness') || combined.includes('medical') ||
      combined.includes('doctor') || combined.includes('physician') || combined.includes('health') ||
      combined.includes('optical') || combined.includes('vision') || combined.includes('pharmacy') ||
      combined.includes('pediatric') || combined.includes('dermatol')) {
    return {
      category: 'healthcare',
      variant: 'healthcare-calm',
      reason: 'Healthcare business detected — healthcare calm template selected.',
    };
  }

  // Restaurant / food
  if (combined.includes('restaurant') || combined.includes('cafe') || combined.includes('food') ||
      combined.includes('kebab') || combined.includes('grill') || combined.includes('pizza') ||
      combined.includes('sushi') || combined.includes('bbq') || combined.includes('bakery') ||
      combined.includes('catering') || combined.includes('bistro') || combined.includes('diner') ||
      combined.includes('bar') && combined.includes('food')) {
    return {
      category: 'restaurant',
      variant: 'restaurant-warm',
      reason: 'Restaurant/food business detected — restaurant warm template selected.',
    };
  }

  // Professional: consulting, accounting, agency
  if (combined.includes('consult') || combined.includes('accounting') || combined.includes('agency') ||
      combined.includes('marketing') || combined.includes('financial') || combined.includes('insurance') ||
      combined.includes('real estate') || combined.includes('broker') || combined.includes('agent')) {
    return {
      category: 'professional',
      variant: 'modern-clean',
      reason: 'Professional services business detected — modern clean template selected.',
    };
  }

  // Default: general-service → modern-clean
  return {
    category: 'general-service',
    variant: 'modern-clean',
    reason: 'Default general-service template selected — no specific industry detected.',
  };
}