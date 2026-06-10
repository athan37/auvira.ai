/** Semantic class names for product app chrome (editor, dashboard, clone, chat). */

export const TEXT = {
  primary: 'text-[#1d1d1f]',
  muted: 'text-[#6e6e73]',
  tertiary: 'text-[#86868b]',
} as const;

export const CANVAS = {
  mesh: 'bg-mesh-canvas',
  alt: 'bg-mesh-alt',
  freeze: 'bg-mesh-freeze',
  /** @deprecated Use CANVAS.mesh */
  legacy: 'bg-brand-canvas',
} as const;

export const SURFACE = {
  canvas: CANVAS.mesh,
  alt: CANVAS.alt,
  panel: 'glass-panel',
  card: 'glass-card',
  input: 'glass-input',
  elevated: 'glass-elevated',
} as const;

export const ACCENT = {
  primary: 'btn-blue-primary text-white',
  link: 'text-blue-600 hover:text-blue-500',
  ring: 'focus-visible:ring-blue-500/35',
  tabActive: 'border-b-2 border-blue-500 text-[#1d1d1f]',
  pill: 'bg-blue-50/80 text-blue-700 ring-1 ring-blue-300/40 shadow-sm backdrop-blur-sm',
  dropZone: 'ring-2 ring-rose-400 ring-offset-2 bg-rose-50/40',
  /** Rose — drag pins, targeting, marketing warmth */
  rose: 'text-rose-700',
  rosePill: 'bg-rose-50 text-rose-700 ring-1 ring-rose-300/40 shadow-sm',
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
  progressTrackPane: 'loader-progress-track-pane',
  progressShimmer: 'loader-progress-shimmer',
  progressFill: 'loader-progress-fill',
  inlineBar: 'loader-inline-bar',
  dots: 'loader-dots-four',
  dotsLg: 'loader-dots-four loader-dots-four--lg',
  heroEllipsis: 'loader-hero-ellipsis',
  skeleton: 'skeleton-mesh',
  /** Plain opaque canvas for full-screen / preview loaders — no mesh blobs. */
  shell: 'bg-loader-shell',
} as const;
