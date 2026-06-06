import { describe, expect, it } from 'vitest';
import {
  buildActionsSectionsFromPreset,
  getCategoryPreset,
  listCategoryPresets,
  recommendCategoryFromIndustry,
} from '@/lib/builder/categoryPresets';

describe('categoryPresets', () => {
  it('lists five category presets with action modules', () => {
    const presets = listCategoryPresets();
    expect(presets).toHaveLength(5);
    for (const preset of presets) {
      expect(preset.defaultSections.length).toBeGreaterThan(0);
      expect(preset.actionModules.length).toBeGreaterThan(0);
      expect(preset.layoutStarterId).toBeTruthy();
      expect(preset.defaultHeroCta).toBeTruthy();
    }
  });

  it('builds seeded action sections per preset', () => {
    for (const preset of listCategoryPresets()) {
      const sections = buildActionsSectionsFromPreset(preset);
      expect(sections.length).toBe(preset.actionModules.length);
      for (const section of sections) {
        expect(section.type).toBe('actions');
        expect(section.moduleKind).toBeTruthy();
        expect(section.actionItems?.length).toBeGreaterThan(0);
      }
    }
  });

  it('recommends category from industry keywords', () => {
    expect(recommendCategoryFromIndustry('café and bakery')).toBe('store_menu');
    expect(recommendCategoryFromIndustry('nonprofit gala')).toBe('fundraising_event');
    expect(recommendCategoryFromIndustry('freelance designer')).toBe('portfolio_resume');
    expect(recommendCategoryFromIndustry('SaaS startup')).toBe('landing_page');
    expect(recommendCategoryFromIndustry('HVAC contractor')).toBe('service_business');
  });

  it('defaults unknown ids to service_business', () => {
    expect(getCategoryPreset('unknown').id).toBe('service_business');
  });
});
