import { describe, expect, it } from 'vitest';
import { buttonVariants } from '@/components/ui/buttonStyles';
import { ACCENT, CANVAS, LOADING, SURFACE } from '@/content/productTheme';
import { BLUE, INTRO, INTRO_ACCENTS } from '@/content/marketingTheme';
import fs from 'node:fs';
import path from 'node:path';

describe('design system contract', () => {
  it('maps primary button to blue CTA', () => {
    expect(buttonVariants.primary).toContain('btn-blue-primary');
    expect(buttonVariants.primary).not.toContain('btn-rose-primary');
  });

  it('exposes mesh canvas and glass surface tokens', () => {
    expect(CANVAS.mesh).toBe('bg-mesh-canvas');
    expect(SURFACE.card).toBe('glass-card');
    expect(SURFACE.cardBright).toBe('glass-card-bright rounded-2xl');
    expect(SURFACE.input).toBe('glass-input');
    expect(ACCENT.primary).toContain('btn-blue-primary');
    expect(ACCENT.tabActive).toContain('border-blue-500');
  });

  it('defines blue marketing CTA utilities', () => {
    expect(BLUE.btnPrimary).toBe('btn-blue-primary');
  });

  it('defines mesh canvas and glass utilities in globals.css', () => {
    const globals = fs.readFileSync(
      path.join(process.cwd(), 'src/app/globals.css'),
      'utf8'
    );
    expect(globals).toContain('.bg-mesh-canvas');
    expect(globals).toContain('.bg-loader-shell');
    expect(globals).toContain('.btn-blue-primary');
    expect(globals).toContain('.glass-input');
    expect(globals).toContain('prefers-reduced-transparency');
  });

  it('maps progress-first loading tokens', () => {
    expect(LOADING.shell).toBe('bg-loader-shell');
    expect(LOADING.inlineBar).toBe('loader-inline-bar');
    expect(LOADING.dots).toBe('loader-dots-four');
    expect(LOADING.dotsLg).toBe('loader-dots-four loader-dots-four--lg');
    expect(LOADING.progressTrackPane).toBe('loader-progress-track-pane');
    expect(LOADING.progressFill).toBe('loader-progress-fill');
    expect(LOADING.skeleton).toBe('skeleton-mesh');
    expect(LOADING.progressTrack).toBe('loader-progress-track');
    expect(LOADING.progressShimmer).toBe('loader-progress-shimmer');
  });

  it('defines four-dot mesh glow loader in globals.css', () => {
    const globals = fs.readFileSync(
      path.join(process.cwd(), 'src/app/globals.css'),
      'utf8'
    );
    expect(globals).toContain('.skeleton-mesh');
    expect(globals).toContain('.skeleton-rose');
    expect(globals).toContain('.loader-inline-bar');
    expect(globals).toContain('.loader-dots-four');
    expect(globals).toContain('.loader-dots-four--lg');
    expect(globals).toContain('--loader-dot-sky');
    expect(globals).toContain('--loader-dot-lavender');
    expect(globals).toContain('--loader-dot-lemon');
    expect(globals).toContain('--loader-dot-blue');
    expect(globals).toContain('--loader-fill');
    expect(globals).toContain('--loader-shimmer');
    expect(globals).toMatch(/\.loader-progress-fill[\s\S]*var\(--loader-fill\)/);
    expect(globals).toMatch(/\.loader-dots-four > span:nth-child\(4\)/);
    const skeletonShimmer = globals.match(
      /\.skeleton-mesh::after[\s\S]*?\{[\s\S]*?mesh-shimmer-sweep/
    );
    expect(skeletonShimmer).toBeTruthy();
    expect(skeletonShimmer![0]).toContain('184, 216, 245');
    expect(skeletonShimmer![0]).not.toContain('241, 205, 215');
  });

  it('uses four-dot glow loaders in shell, preview, and Loading', () => {
    const shell = fs.readFileSync(
      path.join(process.cwd(), 'src/components/ui/LoadingShell.tsx'),
      'utf8'
    );
    const preview = fs.readFileSync(
      path.join(process.cwd(), 'src/components/ProjectPreviewFrame.tsx'),
      'utf8'
    );
    const loading = fs.readFileSync(
      path.join(process.cwd(), 'src/components/ui/Loading.tsx'),
      'utf8'
    );
    const dots = fs.readFileSync(
      path.join(process.cwd(), 'src/components/ui/LoadingDots.tsx'),
      'utf8'
    );

    expect(shell).toContain('LOADING.shell');
    expect(shell).toContain('LOADING.progressTrack');
    expect(shell).toContain('LoadingDots');
    expect(shell).not.toContain('RoseOrbitSvg');

    expect(preview).toContain('LOADING.progressTrackPane');
    expect(preview).toContain('LoadingDots');
    expect(preview).not.toContain('RoseOrbitSvg');

    expect(loading).toContain('LOADING.inlineBar');
    expect(loading).toContain('LoadingDots');
    expect(loading).not.toContain('RoseOrbitSvg');

    expect(dots).toContain('LOADING.dots');
    expect(dots).toContain('LOADING.dotsLg');
  });

  it('exposes intro landing accent tokens for all sections', () => {
    expect(INTRO.section).toBe('intro-section');
    expect(INTRO.pageMesh).toBe('bg-mesh-canvas');
    expect(INTRO.promoAccent).toBe('intro-promo-accent');
    for (const id of ['hero', 'describe', 'preview', 'edit', 'publish', 'final'] as const) {
      expect(INTRO_ACCENTS[id].eyebrow).toMatch(/^text-rose-/);
      expect(INTRO_ACCENTS[id].glow).toMatch(/^intro-rose-glow-/);
    }
    expect(INTRO_ACCENTS.preview.stripe).toBe('intro-promo-accent');
    expect(INTRO_ACCENTS.publish.checkmark).toBe('bg-rose-700');
  });

  it('defines intro rose glow utilities in globals.css', () => {
    const globals = fs.readFileSync(
      path.join(process.cwd(), 'src/app/globals.css'),
      'utf8'
    );
    expect(globals).toContain('.intro-promo-accent');
    expect(globals).toContain('.intro-section');
    expect(globals).toContain('.bg-mesh-canvas');
    expect(globals).not.toContain('.bg-mesh-intro-a');
    expect(globals).toContain('.intro-rose-glow-tr');
    expect(globals).toContain('.intro-rose-glow-bl');
    expect(globals).toContain('.intro-rose-glow-br');
    expect(globals).toContain('.intro-rose-glow-center');
    expect(globals).not.toContain('.intro-section-feather');
    expect(globals).not.toContain('.intro-rose-corner');
  });

  it('uses unified intro section shell without theme forks', () => {
    const spotlight = fs.readFileSync(
      path.join(process.cwd(), 'src/components/marketing/FeatureSpotlight.tsx'),
      'utf8'
    );
    const introPage = fs.readFileSync(
      path.join(process.cwd(), 'src/app/intro/page.tsx'),
      'utf8'
    );
    const hero = fs.readFileSync(
      path.join(process.cwd(), 'src/components/marketing/LandingHero.tsx'),
      'utf8'
    );

    expect(spotlight).toContain('IntroSection');
    expect(spotlight).toContain('INTRO_ACCENTS');
    expect(spotlight).not.toContain('isPromo');
    expect(spotlight).not.toContain('isDark');
    expect(spotlight).not.toContain('intro-dark-glass');
    expect(spotlight).not.toContain('bg-mesh-alt');
    expect(spotlight).not.toMatch(/<section[\s\S]*ROSE\.gradient/);
    expect(hero).toContain('IntroSection');
    expect(hero).not.toContain('INTRO.atmosphere');
    expect(introPage).toContain('INTRO.pageMesh');
    expect(introPage).toContain('fixed inset-0');
    expect(introPage).not.toContain('meshFlip');
    const introSection = fs.readFileSync(
      path.join(process.cwd(), 'src/components/marketing/IntroSection.tsx'),
      'utf8'
    );
    expect(introSection).not.toContain('accent.glow');
  });

  it('defines brighter dashboard glass and applies it on dashboard page', () => {
    const globals = fs.readFileSync(
      path.join(process.cwd(), 'src/app/globals.css'),
      'utf8'
    );
    const dashboard = fs.readFileSync(
      path.join(process.cwd(), 'src/app/dashboard/page.tsx'),
      'utf8'
    );
    const card = fs.readFileSync(
      path.join(process.cwd(), 'src/components/ui/Card.tsx'),
      'utf8'
    );

    expect(globals).toContain('.glass-card-bright');
    expect(globals).toContain('rgb(255 255 255 / 0.84)');
    expect(globals).toContain('var(--cta-blue) 24%');
    expect(globals).toContain('border-radius: 18px');
    expect(globals).toMatch(/prefers-reduced-transparency[\s\S]*\.glass-card-bright/);
    expect(card).toContain("bright: 'glass-card-bright");
    expect(dashboard).toContain('variant="bright"');
    expect(dashboard).not.toContain('variant="glass"');
  });
});
