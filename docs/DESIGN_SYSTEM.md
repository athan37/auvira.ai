# Design System — Glassmorphism UI

Single source of truth for First Site product chrome. **Pastel mesh canvas**, frosted glass panels, **blue primary CTAs**, navy typography, rose as secondary accent (drag pins, targeting), restrained motion.

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
| Primary CTA | `--cta-blue` | `#3B82F6` | Buttons, links, active tabs |
| CTA hover | `--cta-blue-hover` | `#2563EB` | Hover |
| Rose (secondary) | `--rose-raspberry` | `#C83E5F` | Drag pins, drop zones, marketing |
| Mesh sky | `--mesh-sky` | `#B8D8F5` | Canvas blob |
| Mesh lemon | `--mesh-lemon` | `#F8E8A8` | Canvas blob |
| Mesh lavender | `--mesh-lavender` | `#D8C8F5` | Canvas blob |
| Mesh blush | `--mesh-blush` | `#F5D4E8` | Canvas blob |
| Glass fill | `--color-glass` | `rgb(255 255 255 / 0.22)` | Frosted panels |
| Glass border | `--color-border-glass` | `rgb(255 255 255 / 0.45)` | Glass rim |
| Danger | — | `#ff3b30` | Destructive |
| Success | — | `#34c759` | Status only |

Tailwind: `brand-*` maps to the blue accent scale for backward compatibility. Prefer semantic classes: `text-brand-600`, `bg-brand-600`, `text-[#6e6e73]`.

## Canvas (page background)

Product pages use a **pastel mesh gradient** — sky blue, lemon, lavender, blush blobs over a light base. Glass panels blur this colorful canvas.

### Utilities

| Class | Usage |
|-------|--------|
| `.bg-mesh-canvas` | Full-page roots: `body`, `AppShell`, landing, sign-in |
| `.bg-mesh-alt` | Alternate bands: toolbars, card headers |
| `.bg-mesh-freeze` | Preview freeze overlay during edits |
| `.bg-brand-canvas` | Alias → `.bg-mesh-canvas` |

Use `CANVAS.mesh` / `SURFACE.canvas` from `@/content/productTheme` — do not hardcode flat `bg-white` for page roots.

### Landing vs product

| Zone | Background |
|------|------------|
| Product (dashboard, editor, clone, scratch) | Mesh canvas |
| Landing hero | Mesh + optional rose atmosphere overlay |
| Cards / inputs | `glass-card` / `glass-input` (translucent, not solid white) |

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
| Link | `text-blue-600 hover:underline underline-offset-4` |

## Buttons

| Variant | Pattern | Use |
|---------|---------|-----|
| Primary | `.btn-blue-primary` | Main CTAs — blue gradient, `--cta-shadow` |
| Primary rose | `.btn-rose-primary` | Rare brand moments |
| Secondary | `.btn-blue-outline` | Outline pills |
| Secondary link | `secondaryLink` | Inline underline CTAs |
| Glass | `.btn-glass` | Attach, mic, tertiary actions |
| Ghost | minimal + `hover:bg-black/[0.04]` | Toolbar icons |
| Danger | `.btn-danger` | Destructive actions |

**Typography:** `font-medium tracking-[-0.01em]` on all button variants.

**Sizes:** `sm` h-8, `md` h-10, `lg` h-11 (all `rounded-full`).

**Shadows:** Use `--rose-shadow-cta` on buttons; reserve `--rose-shadow-glass` for cards/promo only.

**Small controls:** `.chip-rose` (prompt pills, tags), `.btn-icon` (chevrons, icon buttons).

Use `Button` from `@/components/ui/Button` or `MarketingLink` on public pages.

## Glass

```css
.glass-panel     — frosted white 22%, saturate(150%) blur(14px)
.glass-nav       — sticky header, white 28%
.glass-card      — glass-panel + rounded-2xl
.glass-input     — form fields, white 35%
.glass-elevated  — toasts/modals, white 55%
.glass-dark      — dark frosted overlay
```

`prefers-reduced-transparency: reduce` → opaque white panels (no blur).

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

## Loading (progress-first)

Unified loading system for product chrome. Do **not** use raw `animate-spin`, border spinners, or ornate ring graphics in app UI.

Loaders are **typography + blue progress bars** — the same language as primary CTAs and editor chrome.

### Anatomy

1. **Inline bar** — `loader-inline-bar` (3px shimmer) for buttons, rows, and lazy panels
2. **Four-dot glow** — `loader-dots-four` (sky, lavender, lemon, blue mesh colors with soft glow) for panel, shell, and preview waits
3. **Progress track** — `loader-progress-track` / `loader-progress-shimmer` (indeterminate) or `loader-progress-fill` (determinate %)
4. **Plain canvas** — `LOADING.shell` (`bg-loader-shell`, `#fbfbfd`) for full-screen and preview overlays

`RoseOrbitSvg` is **deprecated** — kept on disk only; do not use in new UI.

### Components

| Component | Import | When to use |
|-----------|--------|-------------|
| `LoadingDots` | `@/components/ui/LoadingDots` | Four-dot mesh glow (`md` or `lg` size) |
| `Loading` | `@/components/ui/Loading` | `sm` / `inline` → thin bar; `md`+ → four-dot glow |
| `LoadingShell` | `@/components/ui/LoadingShell` | Full-page wait — brand + dots + message + indeterminate bar |
| `SkeletonBlock` / `SkeletonText` / `SkeletonCircle` | `@/components/ui/Skeleton` | Content placeholders while data loads |
| `Spinner` | `@/components/ui/Spinner` | **Deprecated alias** → `Loading variant="inline"` |

**Preview bootstrap:** `PreviewPaneLoadingOverlay` uses four-dot glow + title + subtitle + determinate `loader-progress-track-pane` + stage label.

### Tokens

```ts
import { LOADING } from '@/content/productTheme';
// shell, inlineBar, dots, dotsLg, progressTrack, progressTrackPane, progressShimmer,
// progressFill, heroEllipsis, skeleton
```

### Reduced motion

When `prefers-reduced-motion: reduce` (or `useReducedMotion()`):

- Dot pulse disabled (static mid-opacity)
- Shell entrance is instant
- Hero ellipsis static (`...`)
- Progress shimmer static at partial fill

### Skeleton shimmer

`.skeleton-mesh` — `#eef2fb` base with transform-based sky/lavender shimmer sweep (`::after`). `.skeleton-rose` is a deprecated alias (same styles) for one release cycle.

### Loader palette

| Element | Colors |
|---------|--------|
| Progress fill / shimmer | `--loader-fill` / `--loader-shimmer` (horizontal mirror of `--cta-gradient`) |
| Track background | `--loader-track-bg` / `--loader-track-bg-pane` |
| Dot 1 sky | `--loader-dot-sky` (`--cta-blue-light`) |
| Dot 2 lavender | `--loader-dot-lavender` |
| Dot 3 lemon | `--loader-dot-lemon` |
| Dot 4 blue | `--loader-dot-blue` (`--cta-blue`) |
| Shell canvas | `#fbfbfd` via `bg-loader-shell` |
| Skeleton base | `#eef2fb` with white + `#b8d8f5` / `#d8c8f5` sweep |

**Out of scope:** generated site runtime loaders in `src/lib/preview/` and builder templates.

## Layout

- Content max width: `max-w-[980px]` (hero), `max-w-7xl` (wide sections)
- Section padding: `py-20 lg:py-28`
- Page canvas: `bg-brand-canvas` — layered neutral grey, not flat white

## Visual QA checklist

- [ ] Page canvas shows soft grey depth (not flat white) on dashboard, editor, clone
- [ ] Primary buttons are rose gradient pills
- [ ] Glass nav blurs content behind it
- [ ] Dark sections use `#1d1d1f` or `#000`
- [ ] Focus rings use rose at 35% opacity
- [ ] Chat bubbles use consistent `rounded-2xl` + glass/rose clarify
- [ ] Editor tabs use rose active underline
- [ ] Clone flow has no green CTAs
- [ ] Mobile nav sheet works on landing
- [ ] Reduced motion disables parallax/float
- [ ] Full-screen loading shows brand + message + blue progress bar on plain `#fbfbfd` canvas (no spinner)
- [ ] Preview bootstrap/freeze overlay uses `LOADING.shell` + `LOADING.progressTrack` tokens
- [ ] Skeleton placeholders use `.skeleton-mesh` (no rose pink sweep)
- [ ] Button inline loads use `Loading size="sm"` without layout stretch

## Raspberry accent (app-wide)

Rose is the **primary accent** across landing and product chrome. Use `productTheme.ts` and `marketingTheme.ts` for semantic class names.

| Token | CSS variable / Tailwind | Value | Usage |
|-------|-------------------------|-------|--------|
| Rose hot | `--rose-hot` / `rose-600` | `#D24460` | Gradient start, dots |
| Raspberry | `--rose-raspberry` / `rose-500` | `#C83E5F` | Gradient mid |
| Deep raspberry | `--rose-deep` / `rose-700` | `#BD365E` | Links, text accent |
| Soft rose | `--rose-soft` / `rose-300` | `#DD8399` | Rings, subtle highlights |
| Pale rose | `--rose-pale` / `rose-50` | `#F1CDD7` | Nav active pill wash |

### Chat bubbles

| Role | Class / pattern |
|------|-----------------|
| User | `.chat-bubble-user` — `#1d1d1f` fill |
| Assistant | `.chat-bubble-assistant` — glass + hairline |
| Clarification | `.chat-bubble-clarify` — rose-50 wash |
| Error | `bg-red-50 border-red-200` — destructive only |

### Editor layout

- Sidebar shell: `rounded-2xl`, tab bar glass, active tab `.editor-tab-active`
- Pinned targets: `.target-pin-card`
- Drop zone: `ring-rose-400 bg-rose-50/40`

### Toast

Use `Toast` from `@/components/ui/Toast` — glass-dark pill, bottom center.

### Status colors

- **Success** `#34c759` / `Badge tone="success"` — status only, never primary CTAs
- **Destructive** red unchanged

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
- [ ] App chrome uses rose CTAs and focus rings
- [ ] Focus rings on rose CTAs use `ring-rose-500/35`
