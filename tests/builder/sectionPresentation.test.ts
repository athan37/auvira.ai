import { describe, it, expect } from 'vitest';
import {
  colorNameToBackgroundClass,
  defaultSectionBackgroundKey,
  resolveSectionBackground,
  resolveSectionCardClass,
} from '@/lib/builder/sectionPresentation';

describe('sectionPresentation', () => {
  it('maps color names to Tailwind background classes', () => {
    expect(colorNameToBackgroundClass('yellow')).toBe('bg-yellow-200');
    expect(colorNameToBackgroundClass('bg-blue-500')).toBe('bg-blue-500');
  });

  it('uses per-type preset keys when presentation is unset', () => {
    expect(defaultSectionBackgroundKey('gallery')).toBe('mutedBg');
    expect(defaultSectionBackgroundKey('contact')).toBe('contactBg');
    expect(defaultSectionBackgroundKey('services')).toBe('surfaceBg');
  });

  it('prefers presentation.backgroundClass over preset', () => {
    const preset = { mutedBg: 'bg-slate-100', surfaceBg: 'bg-white', card: 'border' };
    const section = {
      type: 'gallery',
      presentation: { backgroundClass: 'bg-yellow-200' },
    };
    expect(resolveSectionBackground(section, preset)).toBe('bg-yellow-200');
    expect(resolveSectionCardClass(section, preset)).toBe('border');
  });

  it('uses presentation.cardClass when set', () => {
    const preset = { card: 'border-slate-200' };
    const section = {
      type: 'testimonials',
      presentation: { cardClass: 'border-red-300 bg-red-50' },
    };
    expect(resolveSectionCardClass(section, preset)).toBe('border-red-300 bg-red-50');
  });
});
