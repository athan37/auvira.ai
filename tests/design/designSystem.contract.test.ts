import { describe, expect, it } from 'vitest';
import { buttonVariants } from '@/components/ui/buttonStyles';
import { ACCENT, CANVAS, LOADING, SURFACE } from '@/content/productTheme';
import { BLUE } from '@/content/marketingTheme';
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
});
