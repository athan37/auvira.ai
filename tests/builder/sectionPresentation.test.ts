import { describe, it, expect } from 'vitest';
import {
  colorNameToBackgroundClass,
  colorNameToTextClass,
  extractSectionTextClassFromMessage,
  defaultSectionBackgroundKey,
  extractSectionBackgroundClassFromMessage,
  formatSectionBackgroundChangeSummary,
  resolveSectionBackgroundClassForEdit,
  resolveGradientBackgroundClass,
  normalizeGradientBackgroundClass,
  resolveSectionBackground,
  resolveSectionCardClass,
  colorNameToCardClass,
  normalizeCardPresentationClass,
} from '@/lib/builder/sectionPresentation';
import {
  buildDefaultGradientBackgroundClass,
  buildLinearGradientBackgroundClass,
  buildTonalGradientBackgroundClass,
  buildTwoColorGradientBackgroundClass,
} from '@/lib/builder/gradientBuilder';
import { isEmitableTailwindBackgroundClass } from '@/lib/builder/tailwindPresentationSupport';

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

  it('maps color names to Tailwind text classes for heading edits', () => {
    expect(colorNameToTextClass('green')).toBe('text-green-600');
    expect(extractSectionTextClassFromMessage('change heading color to green')).toBe(
      'text-green-600'
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

  it('maps color names to visible solid card backgrounds', () => {
    expect(colorNameToCardClass('red')).toBe('bg-red-600');
    expect(colorNameToCardClass('bg-red-600')).toBe('bg-red-600');
    expect(colorNameToCardClass('border-red-300 bg-red-50')).toBe(
      'border-red-300 bg-red-50'
    );
  });

  it('normalizeCardPresentationClass preserves multi-class card shells', () => {
    expect(
      normalizeCardPresentationClass('border-red-300 bg-red-50', 'change background to red')
    ).toBe('border-red-300 bg-red-50');
    expect(normalizeCardPresentationClass('bg-red-600')).toBe('bg-red-600');
    expect(normalizeCardPresentationClass('border-red-300 bg-red-50')).not.toBe('bg-gray-600');
  });

  it('uses presentation.cardClass when set', () => {
    const preset = { card: 'border-slate-200' };
    const section = {
      type: 'testimonials',
      presentation: { cardClass: 'border-red-300 bg-red-50' },
    };
    expect(resolveSectionCardClass(section, preset)).toBe('border-red-300 bg-red-50');
  });

  it('resolveGradientBackgroundClass supports two-hue gradients', () => {
    expect(
      resolveGradientBackgroundClass(
        'change this background of the section to blue to yellow gradient'
      )
    ).toBe(buildTwoColorGradientBackgroundClass('blue', 'yellow'));
    expect(
      resolveGradientBackgroundClass(
        'change this background of the section to blue to orange gradient'
      )
    ).toBe(buildTwoColorGradientBackgroundClass('blue', 'orange'));
    expect(resolveGradientBackgroundClass('from red to yellow gradient')).toBe(
      buildTwoColorGradientBackgroundClass('red', 'yellow')
    );
    expect(
      isEmitableTailwindBackgroundClass(
        resolveGradientBackgroundClass('change background to blue to yellow gradient')
      )
    ).toBe(true);
  });

  it('single-hue gradient requests stay tonal', () => {
    expect(
      resolveGradientBackgroundClass(
        'change this section "Get Started Today" background to a blue color gradient'
      )
    ).toBe(buildTonalGradientBackgroundClass('blue'));
  });

  it('resolveSectionBackgroundClassForEdit prefers gradient over LLM black override', () => {
    const message =
      'change this section "Get Started Today" background to color gradient';
    expect(
      resolveSectionBackgroundClassForEdit(message, { backgroundColor: 'black' })
    ).toBe(buildDefaultGradientBackgroundClass());
    expect(
      resolveSectionBackgroundClassForEdit(message, { backgroundColor: 'color' })
    ).toBe(buildDefaultGradientBackgroundClass());
  });

  it('formats gradient summaries in plain language', () => {
    const message =
      'change this section "Trusted by Over 400,000 Service Professionals" background to color gradient';
    const gradientClass = extractSectionBackgroundClassFromMessage(message)!;
    expect(formatSectionBackgroundChangeSummary('Trusted by Over 400,000 Service Professionals', gradientClass, message)).toBe(
      'We updated the background of "Trusted by Over 400,000 Service Professionals" to a color gradient.'
    );
    expect(formatSectionBackgroundChangeSummary('Contact', 'bg-red-600')).toBe(
      'Changed background of "Contact" to bg-red-600.'
    );
  });

  it('resolves gradient background class for color gradient phrasing', () => {
    const message =
      'change this section background to color gradient "Everything You Need to Grow Your Business"';
    expect(extractSectionBackgroundClassFromMessage(message)).toBe(
      buildDefaultGradientBackgroundClass()
    );
    expect(resolveGradientBackgroundClass('make section background a blue gradient')).toBe(
      buildTonalGradientBackgroundClass('blue')
    );
  });

  it('resolves black and white gradient with valid RGB arbitrary class', () => {
    const message =
      'change this section "Get Started Today" background to black and white color gradient';
    const gradientClass = resolveGradientBackgroundClass(message);
    expect(gradientClass).toContain('linear-gradient');
    expect(gradientClass).toContain('#ffffff');
    expect(gradientClass).toContain('#000000');
    expect(isEmitableTailwindBackgroundClass(gradientClass)).toBe(true);
    expect(
      resolveSectionBackgroundClassForEdit(message, {
        backgroundClass: 'bg-gradient-to-br from-white-400 via-white-600 to-white-900',
      })
    ).toBe(gradientClass);
  });

  it('treats "back" typo as black in black-and-white gradient prompts', () => {
    const message =
      'change this section "Get Started Today" background to back and white color gradient';
    const gradientClass = resolveGradientBackgroundClass(message);
    expect(gradientClass).toContain('#ffffff');
    expect(gradientClass).toContain('#000000');
  });

  it('normalizes invalid LLM white-shade gradient classes', () => {
    const invalid = 'bg-gradient-to-br from-white-400 via-white-600 to-white-900';
    expect(isEmitableTailwindBackgroundClass(invalid)).toBe(false);
    expect(
      normalizeGradientBackgroundClass(invalid, 'black and white gradient background')
    ).toContain('#ffffff');
  });
});
