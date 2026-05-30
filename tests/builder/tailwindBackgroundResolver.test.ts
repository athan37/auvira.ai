import { describe, expect, it } from 'vitest';
import { isEmitableTailwindBackgroundClass } from '@/lib/builder/tailwindPresentationSupport';
import {
  normalizeTailwindBackgroundClass,
  resolveTailwindBackgroundClass,
  shadeIntentFromMessage,
} from '@/lib/builder/tailwindBackgroundResolver';
import { buildBackgroundPalette } from '@/lib/builder/tailwindBackgroundPalette';

describe('tailwindBackgroundResolver', () => {
  it('maps flat colors to valid Tailwind utilities', () => {
    expect(resolveTailwindBackgroundClass('black')).toBe('bg-black');
    expect(resolveTailwindBackgroundClass('white')).toBe('bg-white');
    expect(normalizeTailwindBackgroundClass('bg-black-600')).toBe('bg-black');
    expect(normalizeTailwindBackgroundClass('bg-white-600')).toBe('bg-white');
  });

  it('maps common aliases to palette classes', () => {
    expect(resolveTailwindBackgroundClass('navy')).toBe('bg-blue-900');
    expect(resolveTailwindBackgroundClass('brown')).toBe('bg-orange-800');
    expect(resolveTailwindBackgroundClass('grey')).toBe('bg-gray-600');
    expect(resolveTailwindBackgroundClass('maroon')).toBe('bg-red-800');
  });

  it('respects light/dark shade intent from owner message', () => {
    expect(
      resolveTailwindBackgroundClass('blue', 'use a light blue background')
    ).toBe('bg-blue-200');
    expect(
      resolveTailwindBackgroundClass('blue', 'make it a dark blue section')
    ).toBe('bg-blue-800');
    expect(shadeIntentFromMessage('pale yellow background')).toBe('light');
    expect(shadeIntentFromMessage('deep green background')).toBe('dark');
  });

  it('finds closest palette class for hex values', () => {
    expect(resolveTailwindBackgroundClass('#000000')).toBe('bg-black');
    expect(resolveTailwindBackgroundClass('#ffffff')).toBe('bg-white');
    expect(resolveTailwindBackgroundClass('#dc2626')).toBe('bg-red-600');
  });

  it('always returns emitable Tailwind background utilities', () => {
    const samples = [
      'black',
      'white',
      'red',
      'navy',
      'magenta',
      'bg-red-600',
      'bg-black-600',
      '#2563eb',
      'unknowncolor',
    ];
    for (const sample of samples) {
      const resolved = resolveTailwindBackgroundClass(sample);
      expect(isEmitableTailwindBackgroundClass(resolved), sample).toBe(true);
    }
  });

  it('embedded palette matches emitable class count', () => {
    const classes = buildBackgroundPalette().map((entry) => entry.className);
    expect(classes).toContain('bg-black');
    expect(classes).toContain('bg-red-600');
    for (const className of classes) {
      expect(isEmitableTailwindBackgroundClass(className)).toBe(true);
    }
  });
});
