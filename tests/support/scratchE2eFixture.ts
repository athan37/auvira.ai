import type { ScratchIntake, WebsitePlan } from '@/lib/agent/schemas';
import { applyScratchTemplateSelectionToPlan } from '@/lib/scratch/applyScratchTemplateSelectionToPlan';
import { OWNER_TEMPLATE_REASON } from '@/lib/builder/ownerTemplateSelection';

/** Synthetic plan shaped like proposeWebsitePlanAgent output (no LLM). */
export const scratchE2eBaseWebsitePlan: WebsitePlan = {
  businessName: 'River City Plumbing',
  industry: 'Home services',
  positioning: 'Fast, reliable plumbing for homeowners in Austin.',
  targetCustomers: ['Homeowners', 'Property managers'],
  primaryGoal: 'Get more leads',
  recommendedPagesOrSections: [
    { name: 'Hero', type: 'hero', priority: 1 },
    { name: 'Services', type: 'services', priority: 2 },
    { name: 'About', type: 'about', priority: 3 },
    { name: 'Contact', type: 'contact', priority: 4 },
  ],
  contentPlan: {
    hero: {
      headline: 'Trusted Plumbing in Austin',
      subheadline: 'Same-day service when you need it most',
      primaryCTA: 'Call now',
      secondaryCTA: 'View services',
    },
    sections: [
      {
        type: 'services',
        title: 'Our Services',
        purpose: 'Core offerings',
        contentNotes: ['Drain cleaning', 'Water heater repair', 'Leak detection'],
      },
      {
        type: 'about',
        title: 'About Us',
        purpose: 'Trust and credentials',
        contentNotes: ['Licensed and insured local team'],
      },
      {
        type: 'contact',
        title: 'Contact',
        purpose: 'Reach the business',
        contentNotes: ['Call or email for a quote'],
      },
    ],
  },
  requiredMissingInfo: [],
  optionalMissingInfo: [],
  suggestedTemplate: {
    category: 'home-services',
    variant: 'local-service-pro',
    reason: 'LLM suggestion',
  },
  riskWarnings: [],
};

export const scratchE2eIntake: ScratchIntake = {
  businessName: 'River City Plumbing',
  industry: 'Home services',
  location: 'Austin, TX',
  services: 'Drain cleaning, Water heater repair, Leak detection',
  targetCustomers: 'Homeowners',
  mainGoal: 'Get more leads',
  phone: '512-555-9999',
  email: 'hello@rivercityplumbing.test',
  address: '',
  desiredStyle: 'home-services',
  notes: '',
};

/** Plan after owner layout + theme selections (matches scratch intake UI defaults). */
export function scratchE2ePlanAfterSelections(): WebsitePlan {
  return applyScratchTemplateSelectionToPlan(scratchE2eBaseWebsitePlan, {
    layoutStarterId: 'phone-first-service',
    templateCategory: 'home-services',
    templateVariant: 'local-service-pro',
  });
}

export const scratchE2eExpectedHeadline = 'Trusted Plumbing in Austin';

export function assertScratchE2ePlanSelections(plan: WebsitePlan): void {
  if (plan.suggestedTemplate.layoutStarterId !== 'phone-first-service') {
    throw new Error(`Expected layout phone-first-service, got ${plan.suggestedTemplate.layoutStarterId}`);
  }
  if (plan.suggestedTemplate.variant !== 'local-service-pro') {
    throw new Error(`Expected variant local-service-pro, got ${plan.suggestedTemplate.variant}`);
  }
  if (plan.suggestedTemplate.reason !== OWNER_TEMPLATE_REASON) {
    throw new Error(`Expected owner template reason, got ${plan.suggestedTemplate.reason}`);
  }
}
