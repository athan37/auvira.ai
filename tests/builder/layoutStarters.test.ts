import { describe, expect, it } from 'vitest';
import {
  applyLayoutStrategyToPreset,
  getDefaultLayoutStarter,
  getLayoutStarter,
  getLayoutStarters,
  getLayoutStartersByCategory,
  getLayoutStarterThemeLabel,
  recommendLayoutStarterForIndustry,
} from '@/lib/builder/layoutStarters';
import { getPreset } from '@/lib/builder/themePresets';

describe('layoutStarters', () => {
  it('returns five layout starters with layoutStrategy', () => {
    const starters = getLayoutStarters();
    expect(starters).toHaveLength(5);
    for (const starter of starters) {
      expect(starter.layoutStrategy.heroLayout).toBeTruthy();
      expect(starter.layoutStrategy.sectionDensity).toBeTruthy();
      expect(starter.layoutStrategy.cardStyle).toBeTruthy();
      expect(starter.layoutStrategy.ctaPlacement).toBeTruthy();
    }
  });

  it('groups starters by use case', () => {
    const grouped = getLayoutStartersByCategory();
    expect(Object.keys(grouped).length).toBeGreaterThanOrEqual(4);
    expect(grouped['Home services']?.[0]?.id).toBe('phone-first-service');
  });

  it('resolves known starter ids', () => {
    const starter = getLayoutStarter('phone-first-service');
    expect(starter?.heroStyle).toBe('phone-first');
    expect(starter?.variant).toBe('local-service-pro');
  });

  it('recommends starters from industry keywords', () => {
    expect(recommendLayoutStarterForIndustry('HVAC contractor').id).toBe('phone-first-service');
    expect(recommendLayoutStarterForIndustry('Family law firm').id).toBe('professional-split');
    expect(recommendLayoutStarterForIndustry('Italian restaurant').id).toBe('menu-feature-restaurant');
    expect(recommendLayoutStarterForIndustry('Dental clinic').id).toBe('appointment-hero-healthcare');
  });

  it('falls back to default starter', () => {
    expect(getDefaultLayoutStarter().id).toBe('centered-minimal');
    expect(getLayoutStarter('unknown-id')).toBeUndefined();
  });

  it('applies layout strategy tokens to preset', () => {
    const starter = getLayoutStarter('phone-first-service')!;
    const preset = applyLayoutStrategyToPreset(getPreset('local-service-pro'), starter);
    expect(preset.heroStyle).toBe('phone-first');
    expect(preset.sectionSpacing).toContain('py-16');
    expect(preset.card).toContain('border-2');
  });

  it('exposes theme label for gallery subtitles', () => {
    const starter = getDefaultLayoutStarter();
    expect(getLayoutStarterThemeLabel(starter)).toContain('Modern');
  });
});
