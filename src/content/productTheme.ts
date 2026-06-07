/** Semantic class names for product app chrome (editor, dashboard, clone, chat). */

export const TEXT = {
  primary: 'text-[#1d1d1f]',
  muted: 'text-[#6e6e73]',
  tertiary: 'text-[#86868b]',
} as const;

export const SURFACE = {
  canvas: 'bg-brand-canvas',
  alt: 'bg-canvas-alt',
  panel: 'glass-panel',
  card: 'glass-card',
} as const;

export const ACCENT = {
  primary: 'btn-rose-primary text-white',
  link: 'text-rose-700 hover:text-rose-600',
  ring: 'focus-visible:ring-rose-500/35',
  tabActive: 'border-b-2 border-rose-600 text-[#1d1d1f]',
  pill: 'bg-rose-50 text-rose-700 ring-1 ring-rose-300/40 shadow-sm',
  dropZone: 'ring-2 ring-rose-400 ring-offset-2 bg-rose-50/40',
} as const;

export const BORDER = { hairline: 'border-[#d2d2d7]/80' } as const;

export const RADIUS = {
  card: 'rounded-2xl',
  bubble: 'rounded-2xl',
  chip: 'rounded-xl',
} as const;

export const CONTROL = {
  chip: 'chip-rose',
  icon: 'btn-icon',
  cardInteractive: 'transition-shadow hover:shadow-card-hover',
} as const;

export const LOADING = {
  ringSpin: 'loader-ring-spin',
  ringSpinReverse: 'loader-ring-spin-reverse',
  ringStatic: 'loader-ring-static',
  ringStaticReverse: 'loader-ring-static-reverse',
  ringPrimary: 'loader-ring-primary',
  ringSecondary: 'loader-ring-secondary',
  ringCore: 'loader-ring-core',
  ringCoreReduced: 'loader-ring-core-reduced',
  progressTrack: 'loader-progress-track',
  progressShimmer: 'loader-progress-shimmer',
  heroEllipsis: 'loader-hero-ellipsis',
  skeleton: 'skeleton-rose',
} as const;
