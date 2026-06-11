# Styling themes reference

Inventory of **Auvira.ai product chrome** (dashboard, editor, clone, landing) and **generated customer-site themes** (clone/scratch/edit output). For component patterns and glass utilities, see [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md).

---

## A. Product app chrome

Single glassmorphism system for the Auvira.ai application UI.

| Layer | Source | Role |
|-------|--------|------|
| CSS variables | `src/app/globals.css` | Mesh canvas, blue CTAs, rose accents, glass, loaders |
| Product tokens | `src/content/productTheme.ts` | `TEXT`, `CANVAS`, `SURFACE`, `ACCENT`, `LOADING`, `BORDER` |
| Marketing tokens | `src/content/marketingTheme.ts` | `BLUE`, `ROSE`, `MESH`, `INTRO`, `INTRO_ACCENTS` |
| UI primitives | `src/components/ui/Button.tsx`, `buttonStyles.ts` | `btn-blue-primary`, `btn-glass`, `btn-danger` |

### Color model

- **Canvas:** `#fbfbfd` with mesh blobs (`--mesh-sky`, `--mesh-lemon`, `--mesh-lavender`, `--mesh-blush`)
- **Typography:** `#1d1d1f` primary, `#6e6e73` muted, `#86868b` tertiary
- **Primary CTA:** blue gradient (`--cta-blue` `#3B82F6` → hover `#2563EB`) — `btn-blue-primary`
- **Secondary accent:** rose/raspberry (`--rose-raspberry` `#C83E5F`) — drag pins, drop zones, intro eyebrows
- **Glass:** `rgb(255 255 255 / 0.22)` fill, 14px blur; `prefers-reduced-transparency` falls back to opaque white

### Intro landing (`/intro`)

Shared `bg-mesh-canvas` backdrop. Per-section rose eyebrow shades via `INTRO_ACCENTS` in `marketingTheme.ts` (hero `rose-400` → publish `rose-800`). Primary CTAs stay **blue**; rose is for accents only.

### Contract tests

`tests/design/designSystem.contract.test.ts` enforces blue primary buttons, mesh canvas tokens, and loader utilities.

---

## B. Generated customer websites

Separate from product chrome. Tailwind class presets are injected into customer `src/app/page.tsx` via `__PRESET_JSON__`.

### Theme variants (`src/lib/builder/themePresets.ts`)

| Variant ID | Display name | Category | Palette character |
|------------|--------------|----------|-------------------|
| `premium-professional` | Premium Professional | legal | Cream/gold (`#F8F4EC`, amber CTA `#C89B3C`) |
| `local-service-pro` | Local Service Pro | home-services | Sky blue (`#F0F9FF`, CTA `#0284C7`) |
| `healthcare-calm` | Healthcare Calm | healthcare | Teal/cyan (`#F0FDFA`, CTA `#0891B2`) |
| `restaurant-warm` | Restaurant Warm | restaurant | Warm orange (`#FFFBEB`, CTA `#EA580C`) |
| `modern-clean` | Modern Clean | general-service | Slate + blue (`bg-white`, CTA `blue-600`) |

Each preset defines: `pageBg`, `surfaceBg`, `mutedBg`, nav, hero (gradient + overlay), buttons, cards, section text, contact/footer, fonts, spacing.

### Layout starters (`src/lib/builder/layoutStarters.ts`)

| Starter ID | Name | Variant | Hero style |
|------------|------|---------|------------|
| `professional-split` | Professional Split | premium-professional | split |
| `centered-minimal` | Centered Minimal | modern-clean | centered |
| `phone-first-service` | Phone-First Service | local-service-pro | phone-first |
| `menu-feature-restaurant` | Menu Feature | restaurant-warm | menu-feature |
| `appointment-hero-healthcare` | Appointment Hero | healthcare-calm | appointment-hero |

Layout modifiers: `heroLayout`, `sectionDensity` (spacious / balanced / compact), `cardStyle` (soft-shadow / bordered / glass / premium-panel), `ctaPlacement`.

### Per-section presentation (edit agent)

Owners can override section styling via `siteConfig.sections[].presentation`:

- `backgroundClass` — section wrapper background
- `cardClass` — inner card / contact panel
- `titleClass`, `bodyClass`, `eyebrowClass` — text colors

Resolved at runtime by `src/lib/builder/sectionPresentation.ts` and inlined `SECTION_PRESENTATION_RUNTIME` in generated `page.tsx`.
