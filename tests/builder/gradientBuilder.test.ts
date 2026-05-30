import { describe, expect, it } from 'vitest';
import {
  buildBlackWhiteGradientBackgroundClass,
  buildDefaultGradientBackgroundClass,
  buildLinearGradientBackgroundClass,
  buildTonalGradientBackgroundClass,
  buildTwoColorGradientBackgroundClass,
  toArbitraryGradientClass,
} from '@/lib/builder/gradientBuilder';
import { isEmitableTailwindBackgroundClass } from '@/lib/builder/tailwindPresentationSupport';

describe('gradientBuilder', () => {
  it('wraps linear-gradient as an emitable arbitrary Tailwind class', () => {
    const cls = buildTwoColorGradientBackgroundClass('blue', 'yellow');
    expect(cls).toBe('bg-[linear-gradient(135deg,#2563eb_0%,#eab308_100%)]');
    expect(isEmitableTailwindBackgroundClass(cls)).toBe(true);
  });

  it('builds two-hue gradients from palette hex stops', () => {
    expect(buildTwoColorGradientBackgroundClass('blue', 'yellow')).toBe(
      buildLinearGradientBackgroundClass([
        { hex: '#2563eb', at: '0%' },
        { hex: '#eab308', at: '100%' },
      ])
    );
    expect(buildTwoColorGradientBackgroundClass('blue', 'orange')).toBe(
      buildLinearGradientBackgroundClass([
        { hex: '#2563eb', at: '0%' },
        { hex: '#f97316', at: '100%' },
      ])
    );
  });

  it('builds tonal and default gradients', () => {
    expect(buildTonalGradientBackgroundClass('blue')).toContain('#2563eb');
    expect(buildTonalGradientBackgroundClass('blue')).toContain('#1e3a8a');
    expect(buildDefaultGradientBackgroundClass()).toContain('#9333ea');
    expect(buildBlackWhiteGradientBackgroundClass()).toContain('#ffffff');
    expect(buildBlackWhiteGradientBackgroundClass()).toContain('#000000');
  });
});
