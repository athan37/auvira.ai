import type { SiteSpec } from '@/lib/agent/schemas';
import {
  createActionItem,
  type ActionItem,
  type ActionModuleKind,
  type ActionType,
} from '@/lib/builder/actionItemTypes';
import type { LayoutStarterId } from '@/lib/builder/layoutStarters';

/** Website category ids for hackathon presets. */
export type WebsiteCategoryId =
  | 'service_business'
  | 'store_menu'
  | 'fundraising_event'
  | 'portfolio_resume'
  | 'landing_page';

export interface CategoryActionModule {
  kind: ActionModuleKind;
  sectionTitle: string;
  sectionSubtitle?: string;
  defaultActionType: ActionType;
  seedItems?: Partial<ActionItem>[];
}

export interface CategoryPreset {
  id: WebsiteCategoryId;
  label: string;
  description: string;
  exampleBusinesses: string[];
  defaultHeroCta: string;
  defaultSecondaryCta?: string;
  layoutStarterId: LayoutStarterId;
  defaultSections: Array<{ type: string; title: string; body?: string }>;
  actionModules: CategoryActionModule[];
  visualAccent: { eyebrowLabel: string; badgeTone: string; gradient: string };
}

const CATEGORY_PRESETS: CategoryPreset[] = [
  {
    id: 'service_business',
    label: 'Service Business',
    description: 'Quote-ready packages for HVAC, plumbing, consulting, and local pros.',
    exampleBusinesses: ['HVAC company', 'Plumber', 'Consultant'],
    defaultHeroCta: 'Get a Free Quote',
    defaultSecondaryCta: 'Call Now',
    layoutStarterId: 'phone-first-service',
    defaultSections: [
      { type: 'about', title: 'Why Choose Us', body: 'Trusted local experts with transparent pricing.' },
      { type: 'features', title: 'How It Works', body: 'Simple steps from request to completion.' },
      { type: 'testimonials', title: 'Customer Reviews', body: 'Real feedback from happy clients.' },
      { type: 'contact', title: 'Contact Us', body: 'Reach out for a quote or emergency service.' },
    ],
    actionModules: [
      {
        kind: 'service_packages',
        sectionTitle: 'Service Packages',
        sectionSubtitle: 'Choose the plan that fits your needs.',
        defaultActionType: 'quote',
        seedItems: [
          { name: 'Basic Service', valueLabel: 'From $149', description: 'Essential tune-up and inspection.' },
          { name: 'Standard Package', valueLabel: 'From $299', description: 'Full service with parts included.' },
          { name: 'Premium Care', valueLabel: 'From $499', description: 'Priority scheduling and extended warranty.' },
        ],
      },
    ],
    visualAccent: { eyebrowLabel: 'Services', badgeTone: 'bg-sky-600', gradient: 'from-sky-600 to-blue-700' },
  },
  {
    id: 'store_menu',
    label: 'Store / Menu',
    description: 'Beautiful menu cards for cafés, bakeries, and retail shops.',
    exampleBusinesses: ['Café', 'Bakery', 'Retail shop'],
    defaultHeroCta: 'Order Now',
    defaultSecondaryCta: 'View Menu',
    layoutStarterId: 'menu-feature-restaurant',
    defaultSections: [
      { type: 'about', title: 'Our Story', body: 'Fresh ingredients and friendly service.' },
      { type: 'gallery', title: 'Gallery', body: 'A peek at our favorites.' },
      { type: 'contact', title: 'Visit Us', body: 'Hours, location, and pickup info.' },
    ],
    actionModules: [
      {
        kind: 'menu_items',
        sectionTitle: 'Menu Highlights',
        sectionSubtitle: 'Customer favorites — made fresh daily.',
        defaultActionType: 'buy',
        seedItems: [
          { name: 'House Latte', valueLabel: '$5.50', description: 'Espresso with steamed milk.' },
          { name: 'Avocado Toast', valueLabel: '$9.00', description: 'Sourdough, avocado, chili flakes.' },
          { name: 'Seasonal Pastry', valueLabel: '$4.25', description: 'Rotating baker’s pick.' },
        ],
      },
    ],
    visualAccent: { eyebrowLabel: 'Menu', badgeTone: 'bg-amber-600', gradient: 'from-amber-600 to-orange-700' },
  },
  {
    id: 'fundraising_event',
    label: 'Fundraising / Event',
    description: 'Donation tiers and RSVP blocks for nonprofits and community events.',
    exampleBusinesses: ['Nonprofit gala', 'School fundraiser', 'Community event'],
    defaultHeroCta: 'Donate Today',
    defaultSecondaryCta: 'Learn More',
    layoutStarterId: 'centered-minimal',
    defaultSections: [
      { type: 'about', title: 'Our Mission', body: 'Together we can make a lasting impact.' },
      { type: 'features', title: 'Event Details', body: 'Date, venue, and schedule at a glance.' },
      { type: 'contact', title: 'Get Involved', body: 'Volunteer or sponsor — every bit helps.' },
    ],
    actionModules: [
      {
        kind: 'donation_tiers',
        sectionTitle: 'Support Our Cause',
        sectionSubtitle: 'Pick a tier that works for you.',
        defaultActionType: 'donate',
        seedItems: [
          { name: 'Friend', valueLabel: '$25', description: 'Helps cover supplies for one participant.' },
          { name: 'Champion', valueLabel: '$100', description: 'Sponsors a full scholarship spot.' },
          { name: 'Hero', valueLabel: '$250', description: 'Funds a complete program day.' },
        ],
      },
      {
        kind: 'event_rsvp',
        sectionTitle: 'Reserve Your Spot',
        sectionSubtitle: 'RSVP for the main event.',
        defaultActionType: 'rsvp',
        seedItems: [
          { name: 'General Admission', valueLabel: 'Free', description: 'Join us for the community celebration.' },
        ],
      },
    ],
    visualAccent: { eyebrowLabel: 'Fundraising', badgeTone: 'bg-rose-600', gradient: 'from-rose-600 to-pink-700' },
  },
  {
    id: 'portfolio_resume',
    label: 'Portfolio / Resume',
    description: 'Showcase work and contact CTAs for creatives and freelancers.',
    exampleBusinesses: ['Designer', 'Photographer', 'Freelancer'],
    defaultHeroCta: 'View My Work',
    defaultSecondaryCta: 'Contact Me',
    layoutStarterId: 'professional-split',
    defaultSections: [
      { type: 'about', title: 'About Me', body: 'Background, skills, and approach.' },
      { type: 'gallery', title: 'Selected Work', body: 'Recent projects and case studies.' },
      { type: 'contact', title: 'Let’s Connect', body: 'Available for freelance and full-time roles.' },
    ],
    actionModules: [
      {
        kind: 'portfolio_ctas',
        sectionTitle: 'Featured Projects',
        sectionSubtitle: 'Tap a project to learn more.',
        defaultActionType: 'contact',
        seedItems: [
          { name: 'Brand Identity — Loop Co', valueLabel: 'Case study', description: 'Visual system and web launch.' },
          { name: 'Product Shoot — Ember', valueLabel: 'Gallery', description: 'Campaign photography series.' },
        ],
      },
    ],
    visualAccent: { eyebrowLabel: 'Portfolio', badgeTone: 'bg-violet-600', gradient: 'from-violet-600 to-indigo-700' },
  },
  {
    id: 'landing_page',
    label: 'Startup Landing Page',
    description: 'Conversion-focused hero and booking CTAs for SaaS and app launches.',
    exampleBusinesses: ['SaaS startup', 'App launch', 'Product waitlist'],
    defaultHeroCta: 'Start Free Trial',
    defaultSecondaryCta: 'Book a Demo',
    layoutStarterId: 'centered-minimal',
    defaultSections: [
      { type: 'features', title: 'Why Teams Switch', body: 'Benefits that matter on day one.' },
      { type: 'faq', title: 'FAQ', body: 'Common questions answered.' },
      { type: 'contact', title: 'Talk to Sales', body: 'We respond within one business day.' },
    ],
    actionModules: [
      {
        kind: 'service_packages',
        sectionTitle: 'Plans',
        sectionSubtitle: 'Simple pricing for growing teams.',
        defaultActionType: 'book',
        seedItems: [
          { name: 'Starter', valueLabel: '$29/mo', description: 'For solo founders and small teams.' },
          { name: 'Growth', valueLabel: '$79/mo', description: 'Collaboration and analytics included.' },
          { name: 'Scale', valueLabel: 'Custom', description: 'Enterprise support and SSO.' },
        ],
      },
    ],
    visualAccent: { eyebrowLabel: 'Product', badgeTone: 'bg-emerald-600', gradient: 'from-emerald-600 to-teal-700' },
  },
];

/** All category presets for the chooser UI. */
export function listCategoryPresets(): CategoryPreset[] {
  return CATEGORY_PRESETS;
}

/** Resolve preset by id; defaults to service_business. */
export function getCategoryPreset(id: string | undefined | null): CategoryPreset {
  const found = CATEGORY_PRESETS.find((p) => p.id === id);
  return found ?? CATEGORY_PRESETS[0]!;
}

/** Recommend a category from free-text industry (deterministic). */
export function recommendCategoryFromIndustry(industry?: string): WebsiteCategoryId {
  const text = (industry ?? '').toLowerCase();
  if (/restaurant|food|cafe|café|bakery|menu|retail|shop|store/.test(text)) return 'store_menu';
  if (/nonprofit|charity|fundrais|donat|gala|event|school/.test(text)) return 'fundraising_event';
  if (/design|photo|portfolio|freelanc|creative|artist/.test(text)) return 'portfolio_resume';
  if (/saas|startup|app|software|product launch|tech/.test(text)) return 'landing_page';
  if (/hvac|plumb|contractor|service|consult|legal|law/.test(text)) return 'service_business';
  return 'service_business';
}

/** Build action items from a module definition. */
export function buildActionItemsFromModule(module: CategoryActionModule): ActionItem[] {
  const seeds = module.seedItems ?? [];
  if (!seeds.length) return [];
  return seeds
    .filter((seed): seed is Partial<ActionItem> & { name: string } => Boolean(seed.name?.trim()))
    .map((seed) =>
      createActionItem({
        ...seed,
        name: seed.name,
        actionType: seed.actionType ?? module.defaultActionType,
      })
    );
}

/** Build actions section objects for siteConfig. */
export function buildActionsSectionsFromPreset(preset: CategoryPreset) {
  return preset.actionModules.map((mod) => ({
    type: 'actions' as const,
    title: mod.sectionTitle,
    subtitle: mod.sectionSubtitle,
    body: mod.sectionSubtitle,
    moduleKind: mod.kind,
    actionItems: buildActionItemsFromModule(mod),
  }));
}

/**
 * Merge category preset defaults into a SiteSpec (hero CTAs + section list hints).
 * Action sections are injected at siteConfig generation time.
 */
export function applyCategoryPresetToSiteSpec(
  siteSpec: SiteSpec,
  categoryId: WebsiteCategoryId | string | undefined
): SiteSpec {
  const preset = getCategoryPreset(categoryId);
  const existingTypes = new Set(siteSpec.sections.map((s) => s.type));

  const mergedSections = [...siteSpec.sections];
  for (const sec of preset.defaultSections) {
    if (!existingTypes.has(sec.type as SiteSpec['sections'][0]['type'])) {
      mergedSections.push({
        type: sec.type as SiteSpec['sections'][0]['type'],
        title: sec.title,
        body: sec.body ?? '',
        items: [],
      });
    }
  }

  return {
    ...siteSpec,
    primaryCTA: siteSpec.primaryCTA?.trim() ? siteSpec.primaryCTA : preset.defaultHeroCta,
    secondaryCTA: siteSpec.secondaryCTA?.trim() ? siteSpec.secondaryCTA : preset.defaultSecondaryCta ?? siteSpec.secondaryCTA,
    sections: mergedSections,
  };
}

/** Category preset id stored on generated siteConfig metadata comment. */
export function categoryPresetMetadataComment(categoryId: WebsiteCategoryId): string {
  return `// categoryPreset: ${categoryId}`;
}
