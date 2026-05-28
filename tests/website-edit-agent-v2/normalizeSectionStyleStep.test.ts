import { describe, it, expect } from 'vitest';
import type { SiteModel } from '@/lib/project-workspace/website-edit-agent-v2';
import {
  normalizeSectionStyleStep,
  resolveSectionIndexFromMessage,
} from '@/lib/project-workspace/website-edit-agent-v2/normalizeSectionStyleStep';

const SITE_MODEL: SiteModel = {
  mode: 'gitlab',
  hero: {},
  contact: {},
  sections: [
    { index: 0, type: 'services', title: 'Services', itemCount: 1, items: [] },
    { index: 1, type: 'about', title: 'About Us', itemCount: 0, items: [] },
    { index: 2, type: 'gallery', title: 'Hello', itemCount: 1, items: [] },
    { index: 3, type: 'testimonials', title: 'What Our Customers Say', itemCount: 2, items: [] },
  ],
  files: [],
  capabilities: {
    hasSiteConfig: true,
    hasPage: true,
    hasGlobalsCss: true,
    supportsConfigSkills: true,
  },
};

describe('normalizeSectionStyleStep', () => {
  it('resolves gallery section index from Hello in message', () => {
    expect(
      resolveSectionIndexFromMessage('Change the Hello gallery background to yellow', SITE_MODEL.sections)
    ).toBe(2);
  });

  it('fills backgroundColor when LLM omits it', () => {
    const step = normalizeSectionStyleStep(
      { skill: 'update_section_style', args: { sectionIndex: 2 } },
      'Change the Hello gallery section background to yellow',
      SITE_MODEL
    );
    expect(step.args.backgroundColor).toBe('yellow');
  });

  it('fills cardClass for testimonial card color requests', () => {
    const step = normalizeSectionStyleStep(
      { skill: 'update_section_style', args: { sectionIndex: 3 } },
      'Make the testimonial cards red in What Our Customers Say',
      SITE_MODEL
    );
    expect(step.args.presentation).toMatchObject({
      cardClass: 'border-red-300 bg-red-50',
    });
  });
});
