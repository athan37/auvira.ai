/** Marketing copy — Apple editorial tone. */

export const BRAND = {
  name: 'First Site',
  tagline: 'Your website. Built in minutes.',
  description:
    'Describe your business. Preview your site. Publish when it is ready. No code required.',
} as const;

export const NAV_LINKS = [
  { href: '#describe', label: 'Describe' },
  { href: '#preview', label: 'Preview' },
  { href: '#edit', label: 'Edit' },
  { href: '#publish', label: 'Publish' },
] as const;

export const HERO = {
  headline: 'Your website. Built in minutes.',
  subline:
    'Tell us about your business in plain language. First Site drafts a complete website you can preview, refine, and publish.',
  primaryCta: 'Get started',
  secondaryCta: 'See it in action',
  secondaryHref: '#preview',
} as const;

export const HERO_PROMPTS = [
  'A family dental practice in Austin — warm, trustworthy, book online',
  'Mobile dog grooming, playful and premium',
  'Local bakery with online ordering — cozy and inviting',
] as const;

export const FEATURE_SPOTLIGHTS = [
  {
    id: 'describe' as const,
    eyebrow: 'Describe',
    headline: 'Say it once.',
    subline: 'Paste your existing URL or describe your business in a sentence. First Site extracts what matters and builds from there.',
    cta: 'Learn more',
    ctaHref: '/auth/signin',
  },
  {
    id: 'preview' as const,
    eyebrow: 'Preview',
    headline: 'See it instantly.',
    subline: 'Your draft loads in a live preview. Scroll, click, and decide if the direction feels right before you change a word.',
    cta: 'Try the preview',
    ctaHref: '/auth/signin',
  },
  {
    id: 'edit' as const,
    eyebrow: 'Edit',
    headline: 'Refine in chat.',
    subline: 'Drag any section into chat and describe the change. First Site updates the preview — no HTML, no settings maze.',
    cta: 'See how editing works',
    ctaHref: '#edit',
  },
  {
    id: 'publish' as const,
    eyebrow: 'Publish',
    headline: 'Go live with confidence.',
    subline: 'Built-in checks run before every publish. Your live status only appears when the deployed site is actually ready.',
    cta: 'Get started',
    ctaHref: '/auth/signin',
  },
] as const;

export const FINAL_CTA = {
  headline: 'Ready to build?',
  subline: 'Sign in and see your first draft in minutes.',
  cta: 'Get started',
} as const;

export const FOOTER_LINKS = [
  { href: '#describe', label: 'Describe' },
  { href: '#preview', label: 'Preview' },
  { href: '/auth/signin', label: 'Sign in' },
] as const;
