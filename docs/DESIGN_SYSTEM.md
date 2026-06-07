# Design System — Apple-style UI

Single source of truth for First Site product chrome. Inspired by [apple.com](https://www.apple.com) patterns: neutral canvas, system blue accent, frosted glass, editorial typography, restrained motion.

## Colors

| Token | CSS variable | Hex / value | Usage |
|-------|--------------|---------------|--------|
| Canvas | `--color-canvas` | `#fbfbfd` | Page background |
| Canvas alt | `--color-canvas-alt` | `#f5f5f7` | Alternate section bands |
| Surface | `--color-surface` | `#ffffff` | Cards, inputs |
| Surface dark | `--color-surface-dark` | `#1d1d1f` | Dark product bands |
| Surface black | `--color-surface-black` | `#000000` | Cinematic sections |
| Text primary | `--color-text` | `#1d1d1f` | Headlines, body |
| Text secondary | `--color-text-muted` | `#6e6e73` | Subcopy |
| Text tertiary | `--color-text-tertiary` | `#86868b` | Meta labels |
| Border | `--color-border` | `#d2d2d7` | Hairlines |
| Accent | `--color-accent` | `#0071e3` | Primary actions, links |
| Accent hover | `--color-accent-hover` | `#0077ed` | Hover |
| Accent muted | `--color-accent-muted` | `#e8f2ff` | Soft wash |
| Glass fill | `--color-glass` | `rgb(255 255 255 / 0.72)` | Frosted panels |
| Glass border | `--color-border-glass` | `rgb(255 255 255 / 0.8)` | Glass rim |
| Danger | — | `#ff3b30` | Destructive |
| Success | — | `#34c759` | Status only |

Tailwind: `brand-*` maps to the blue accent scale for backward compatibility. Prefer semantic classes: `text-brand-600`, `bg-brand-600`, `text-[#6e6e73]`.

## Typography

```txt
Font stack: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", var(--font-inter), system-ui, sans-serif
```

| Role | Classes |
|------|---------|
| Display H1 | `text-5xl sm:text-6xl lg:text-[4.5rem] font-semibold tracking-[-0.04em] leading-[1.05]` |
| Section H2 | `text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.03em]` |
| Body | `text-[17px] leading-[1.47] text-[#6e6e73]` |
| Eyebrow | `text-xs font-semibold uppercase tracking-[0.08em] text-[#6e6e73]` |
| Link | `text-brand-600 hover:underline underline-offset-4` |

## Buttons

| Variant | Tailwind pattern |
|---------|------------------|
| Primary | `bg-brand-600 text-white rounded-full hover:bg-brand-500` |
| Secondary | `text-brand-600 hover:underline` (text link) |
| Ghost | `text-[#6e6e73] hover:text-[#1d1d1f]` |
| Glass | `glass-panel rounded-full` |

Sizes: `sm` h-8, `md` h-9, `lg` h-11.

Use `Button` from `@/components/ui/Button` or `MarketingLink` on public pages.

## Glass

```css
.glass-panel     — frosted white, saturate(180%) blur(20px)
.glass-nav       — sticky header variant
.glass-card      — glass-panel + rounded-2xl
.glass-dark      — dark frosted overlay
```

## Radius & shadow

- Pills / buttons: `rounded-full`
- Cards: `rounded-2xl` or `rounded-3xl` (hero frames)
- Shadow: `shadow-glass` — `0 2px 16px rgb(0 0 0 / 0.06)`

## Motion (framer-motion)

| Token | Value |
|-------|--------|
| Ease | `[0.25, 0.1, 0.25, 1]` |
| Entrance duration | `0.6s` |
| Micro duration | `0.3s` |
| Spring | `{ stiffness: 260, damping: 28 }` |
| Stagger | `0.08s` |
| Scroll reveal | opacity 0→1, y 24→0, `viewport: { once: true, margin: "-10%" }` |

Helpers: `@/components/motion` — `FadeIn`, `ScrollReveal`, `StaggerChildren`, `useReducedMotion`.

Respect `prefers-reduced-motion`: no transforms, opacity-only or instant.

## Layout

- Content max width: `max-w-[980px]` (hero), `max-w-7xl` (wide sections)
- Section padding: `py-20 lg:py-28`
- Page canvas: `bg-brand-canvas` (neutral, not green)

## Visual QA checklist

- [ ] No green accent on product chrome
- [ ] Primary buttons are blue pills
- [ ] Glass nav blurs content behind it
- [ ] Dark sections use `#1d1d1f` or `#000`
- [ ] Focus rings use blue at 20% opacity
- [ ] Mobile nav sheet works on landing
- [ ] Reduced motion disables parallax/float

## Raspberry accent (landing only)

Parallel to blue `brand-*` — use `rose-*` **only** on the public landing page and marketing components.

| Token | CSS variable / Tailwind | Value | Usage |
|-------|-------------------------|-------|--------|
| Rose hot | `--rose-hot` / `rose-600` | `#D24460` | Gradient start, dots |
| Raspberry | `--rose-raspberry` / `rose-500` | `#C83E5F` | Gradient mid |
| Deep raspberry | `--rose-deep` / `rose-700` | `#BD365E` | Links, text accent |
| Soft rose | `--rose-soft` / `rose-300` | `#DD8399` | Rings, subtle highlights |
| Pale rose | `--rose-pale` / `rose-50` | `#F1CDD7` | Nav active pill wash |

### When to use rose vs brand

| Context | Accent |
|---------|--------|
| Landing CTAs, hero glow, promo band | `rose-*` |
| Dashboard, editor, sign-in, clone flows | `brand-*` (blue) |

### Rose utilities (globals.css)

- `.bg-rose-atmosphere` — unified multi-point rose light field (hero 35%, final CTA 20%, promo 100%)
- `.glass-rose-premium` — deep translucent glass with inset highlights and rose shadow
- `.glass-specular-edge` — diagonal specular sheen via `::before`
- `.rose-shine-overlay` — subtle promo shine via `::after`
- `.btn-rose-primary` — luminous gradient CTA with inset highlight
- `.bg-rose-gradient` — primary CTA fill + promo section base
- `.border-rose-highlight` / `.shadow-rose-glass` — card hover accents
- `.text-rose-accent` — link text on light backgrounds

### Premium material system (one layer)

Rose is **one material**, not stacked decorations:

| Zone | Layers |
|------|--------|
| Hero | Neutral canvas + `bg-rose-atmosphere` at ~35% opacity |
| Promo | `bg-rose-gradient` + full atmosphere + shine + `glass-rose-premium` visual |
| Final CTA | Neutral `#f5f5f7` + atmosphere at ~20% opacity |
| CTAs | `btn-rose-primary` + `bg-rose-gradient` |

Do **not** embed rose radials in `.bg-brand-canvas` — atmosphere layers only.

### Contrast rules

- White text **only** on `bg-rose-gradient` (buttons, promo section)
- Body copy on light sections stays `#1d1d1f` / `#6e6e73`
- `text-rose-700` links on `#fbfbfd` — OK for large/interactive text
- Avoid body text on `rose-50` / pale rose backgrounds

### Landing QA (raspberry)

- [ ] Canvas reads neutral; raspberry visible on CTAs, glow, preview promo, hovers
- [ ] Only **one** full gradient section (`#preview` promo)
- [ ] App chrome still blue
- [ ] Focus rings on rose CTAs use `ring-rose-500/35`
