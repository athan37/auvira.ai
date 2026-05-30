import { describe, it, expect } from 'vitest';
import {
  colorNameToBackgroundClass,
  defaultSectionBackgroundKey,
  extractSectionBackgroundClassFromMessage,
  resolveGradientBackgroundClass,
  resolveSectionBackground,
  resolveSectionCardClass,
} from '@/lib/builder/sectionPresentation';

describe('sectionPresentation', () => {
  it('maps color names to Tailwind background classes', () => {
    expect(colorNameToBackgroundClass('yellow')).toBe('bg-yellow-600');
    expect(colorNameToBackgroundClass('yellow', 'use a light yellow background')).toBe(
      'bg-yellow-200'
    );
    expect(colorNameToBackgroundClass('bg-blue-500')).toBe('bg-blue-500');
    expect(colorNameToBackgroundClass('red-600')).toBe('bg-red-600');
    expect(colorNameToBackgroundClass('black')).toBe('bg-black');
    expect(colorNameToBackgroundClass('white')).toBe('bg-white');
    expect(colorNameToBackgroundClass('black-600')).toBe('bg-black');
    expect(colorNameToBackgroundClass('navy')).toBe('bg-blue-900');
    expect(colorNameToBackgroundClass('white', 'use a light white background')).toBe(
      'bg-gray-100'
    );
    expect(colorNameToBackgroundClass('black', 'use a light black background')).toBe(
      'bg-gray-800'
    );
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

  it('resolves gradient background class for color gradient phrasing', () => {
    const message =
      'change this section background to color gradient "Everything You Need to Grow Your Business"';
    expect(extractSectionBackgroundClassFromMessage(message)).toBe(
      'bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600'
    );
    expect(resolveGradientBackgroundClass('make section background a blue gradient')).toBe(
      'bg-gradient-to-br from-blue-400 via-blue-600 to-blue-900'
    );
  });
});
