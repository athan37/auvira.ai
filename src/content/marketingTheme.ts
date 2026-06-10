/** Shared accent class names for landing marketing components. */

export const ROSE = {
  gradient: 'bg-rose-gradient',
  glow: 'bg-rose-glow',
  glowSoft: 'bg-rose-glow-soft',
  atmosphere: 'bg-rose-atmosphere',
  atmosphereHero: 'bg-rose-atmosphere opacity-[0.2]',
  atmosphereFinal: 'bg-rose-atmosphere opacity-15',
  text: 'text-rose-700',
  textAccent: 'text-rose-accent',
  borderHighlight: 'border-rose-highlight',
  shadowGlass: 'shadow-rose-glass',
  glassCard: 'glass-card-rose',
  glassPremium: 'glass-rose-premium glass-specular-edge',
  shineOverlay: 'rose-shine-overlay',
  /** @deprecated Use BLUE.btnPrimary */
  btnPrimary: 'btn-rose-primary',
  navPill: 'rounded-full bg-blue-50/80 px-3 py-1 text-blue-700 ring-1 ring-blue-300/40 shadow-sm backdrop-blur-sm',
} as const;

export const BLUE = {
  text: 'text-blue-600',
  textHover: 'hover:text-blue-500',
  btnPrimary: 'btn-blue-primary',
  btnOutline: 'btn-blue-outline text-blue-700',
  link: 'text-blue-600 hover:text-blue-500 hover:underline underline-offset-4',
} as const;

export const MESH = {
  canvas: 'bg-mesh-canvas',
  atmosphere:
    'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_8%_18%,rgba(184,216,245,0.4),transparent_68%),radial-gradient(ellipse_50%_42%_at_92%_28%,rgba(216,200,245,0.35),transparent_65%)]',
} as const;
