/** Marketing copy for intro and landing (Apple editorial tone). */

export const BRAND = {
  name: 'Auvira.ai',
  tagline: 'Your website. Built with AI.',
  description:
    'Auvira is an AI teammate for small business, starting with websites you describe from scratch or refresh from your existing URL. Augmented Vision. Unlimited Potential.',
  /** Scalable mark (transparent); PNG kept for favicon raster fallback. */
  logoSrc: '/brand/auvira-logo.svg',
  logoPngSrc: '/brand/auvira-logo.png',
  logoAlt: 'Auvira.ai logo',
} as const;

export type IntroDemoId =
  | 'teamsToChat'
  | 'memory'
  | 'describe'
  | 'cloneFromUrl'
  | 'dragToChat';

export const INTRO_DEMO_PROMPT =
  'A family dental practice in Austin, warm and trustworthy, book online' as const;

/** Suggestion chips for the websites intro demo (assembled into INTRO_DEMO_PROMPT). */
export const INTRO_DEMO_DESCRIBE_CHIPS = [
  'Family dental practice',
  'Warm & trustworthy',
  'Book online',
] as const;

/** Site sections that build in the websites intro demo wireframe. */
export const INTRO_DEMO_DESCRIBE_SECTIONS = [
  'Navigation',
  'Hero',
  'Services',
  'Contact',
] as const;

export const INTRO_DEMO_WHY_REQUEST =
  'Update our hours and refresh the homepage for spring.' as const;

export const INTRO_DEMO_WHY_REPLY =
  'Done. Built, updated, and maintained. Your site stays live.' as const;

export const INTRO_DEMO_WHY_BURDEN = [
  'Developer',
  'Agency',
  'Operator',
  'Ongoing dev costs',
] as const;

export const INTRO_DEMO_WHY_HANDLED = [
  'Built for you',
  'Changes applied',
  'Maintained for you',
] as const;

export const INTRO_DEMO_DRAG_LABEL = 'Hero › Headline' as const;

export const INTRO_DEMO_VISION_VOICE_EDIT =
  'Make the hero headline warmer and friendlier.' as const;

export const INTRO_DEMO_VISION_EDIT_REPLY =
  'Updated hero headline with a warmer tone applied.' as const;

export const INTRO_DEMO_CLONE_URL = 'https://northstardental.com' as const;

export const INTRO_DEMO_CLONE_STEPS = [
  'Crawling pages',
  'Extracting content',
  'Preserving your copy',
] as const;

export const INTRO_DEMO_CLONE_PRESERVED = [
  'Services',
  'About',
  'Contact',
  'Hours',
] as const;

export const NAV_LINKS = [
  { href: '#vision', label: 'Vision' },
  { href: '#why', label: 'Why' },
  { href: '#teammate', label: 'Teammate' },
  { href: '#websites', label: 'Websites' },
  { href: '#clone', label: 'Clone' },
] as const;

export const HERO = {
  headline: "The future of small business won't be built by larger teams.",
  subline:
    "Most small businesses can't hire developers, designers, marketers, and operators, yet customers expect the same digital experience as large companies. That's why we're building Auvira.",
  primaryCta: 'Get started',
  secondaryCta: 'Our vision',
  secondaryHref: '#vision',
} as const;

export const INTRO_NARRATIVE = [
  {
    id: 'vision' as const,
    demo: 'dragToChat' as const,
    eyebrow: 'Our vision',
    headline: 'The AI operating system for small business.',
    subline:
      "We're not building another website builder. We're building a teammate that learns, remembers, and grows alongside every organization it serves. After your site is live, refine it by dragging a section into chat or speaking your edit out loud.",
    tagline: 'Augmented Vision. Unlimited Potential.',
  },
  {
    id: 'why' as const,
    demo: 'teamsToChat' as const,
    eyebrow: 'Why',
    headline: 'An unfair burden.',
    subline:
      'Most small businesses could never afford a team to build and run a website. With Auvira, you craft and maintain yours your way. Say what you want, we handle the rest. No developers. No agencies. Full control, zero technical upkeep.',
  },
  {
    id: 'teammate' as const,
    demo: 'memory' as const,
    eyebrow: 'AI teammate',
    headline: 'An AI teammate that learns.',
    subline:
      'Most AI tools start every conversation from scratch. Auvira is built so every interaction strengthens its understanding of your business, not from templates, but from context.',
  },
  {
    id: 'websites' as const,
    demo: 'describe' as const,
    eyebrow: 'Where we start',
    headline: 'Starting with ideas.',
    subline:
      'Every business starts with an idea. Describe what you want in plain language. No coding, no agencies, no complicated software. Just conversation, whether you begin from scratch or paste an existing URL. Your website is how Auvira first learns your organization.',
  },
  {
    id: 'clone' as const,
    demo: 'cloneFromUrl' as const,
    eyebrow: 'Or refresh yours',
    headline: 'Clone any existing website.',
    subline:
      'Already have a site? Paste the URL. Auvira crawls your pages, preserves your content and contact details, and rebuilds a modern draft you can enhance without starting from scratch.',
  },
] as const;

export const FOOTER_LINKS = [
  { href: '#vision', label: 'Vision' },
  { href: '#why', label: 'Why' },
  { href: '#teammate', label: 'Teammate' },
  { href: '#websites', label: 'Websites' },
  { href: '#clone', label: 'Clone' },
  { href: '/auth/signin', label: 'Sign in' },
] as const;
