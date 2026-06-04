import { describe, expect, it } from 'vitest';
import { buildSectionElementCatalog } from '@/lib/project-workspace/edit-context/sectionElementRegistry';
import {
  extractTargetPhrase,
  matchSectionElementPhrase,
} from '@/lib/project-workspace/edit-context/matchSectionElementPhrase';
import { resolveConfigTextEdit } from '@/lib/project-workspace/edit-context/resolveConfigTextEdit';

const CONTACT_CONFIG = `export const siteConfig = {
  businessName: 'Demo',
  hero: { headline: 'Hero', subheadline: '', primaryCta: 'Get in Touch' },
  contact: { phone: '555-0100', email: 'hello@demo.test' },
  sections: [
    {
      type: 'contact',
      title: 'Get Started Today',
      body: 'Reach out anytime.',
      subtitle: 'Contact Information',
      analyticsId: 'contact-1',
    },
  ],
};`;

const SERVICES_CONFIG = `export const siteConfig = {
  businessName: 'Demo',
  hero: { headline: 'Hero', subheadline: '' },
  contact: {},
  sections: [
    {
      type: 'services',
      title: 'Our Services',
      body: 'What we offer.',
      items: [{ title: 'Drain Cleaning', description: 'Fast drain service' }],
    },
  ],
};`;

describe('extractTargetPhrase', () => {
  it('parses change X to Y with element phrase', () => {
    const result = extractTargetPhrase('change get in touch btn to Contact Us');
    expect(result).toEqual({ targetPhrase: 'get in touch btn', value: 'Contact Us' });
  });

  it('parses unquoted target phrase with ordinals', () => {
    const result = extractTargetPhrase('change first service card to Emergency Plumbing');
    expect(result?.targetPhrase).toBe('first service card');
    expect(result?.value).toBe('Emergency Plumbing');
  });

  it('strips wrapping quotes from trailing quoted value', () => {
    const result = extractTargetPhrase(
      'change contact information title of the card to "this is david"'
    );
    expect(result?.targetPhrase.toLowerCase()).toContain('contact information');
    expect(result?.value).toBe('this is david');
  });

  it('returns null for find/replace quoted pairs', () => {
    expect(extractTargetPhrase('change "old" to "new"')).toBeNull();
  });
});

describe('matchSectionElementPhrase', () => {
  it('routes get in touch btn to hero.primaryCta', () => {
    const catalog = buildSectionElementCatalog(CONTACT_CONFIG, 0);
    const result = matchSectionElementPhrase(
      'get in touch btn',
      catalog,
      'change get in touch btn to Contact Us',
      'Contact Us'
    );
    expect(result.kind).toBe('apply');
    if (result.kind === 'apply') {
      expect(result.fieldPath).toBe('hero.primaryCta');
      expect(result.value).toBe('Contact Us');
    }
  });

  it('disambiguates phone in card vs phone button', () => {
    const catalog = buildSectionElementCatalog(CONTACT_CONFIG, 0);
    const cardResult = matchSectionElementPhrase(
      'phone in card',
      catalog,
      'change phone in card to 555-9999',
      '555-9999'
    );
    expect(cardResult.kind).toBe('apply');
    if (cardResult.kind === 'apply') {
      expect(cardResult.surface.placement).toBe('inner_card');
    }

    const buttonResult = matchSectionElementPhrase(
      'phone button',
      catalog,
      'change phone button to 555-8888',
      '555-8888'
    );
    expect(buttonResult.kind).toBe('apply');
    if (buttonResult.kind === 'apply') {
      expect(buttonResult.surface.placement).toBe('left_column');
    }
  });

  it('matches first service card phrase to item title', () => {
    const catalog = buildSectionElementCatalog(SERVICES_CONFIG, 0);
    const result = matchSectionElementPhrase(
      'first service card',
      catalog,
      'change first service card to Emergency Plumbing',
      'Emergency Plumbing'
    );
    expect(result.kind).toBe('apply');
    if (result.kind === 'apply') {
      expect(result.fieldPath).toBe('sections[0].items[0].title');
    }
  });
});

describe('resolveConfigTextEdit element phrase integration', () => {
  it('applies pinned contact section + btn phrase via hero.primaryCta', () => {
    const result = resolveConfigTextEdit({
      message: 'change get in touch btn to Contact Us',
      siteConfigContent: CONTACT_CONFIG,
      pinnedSectionIndex: 0,
    });
    expect(result.kind).toBe('apply');
    if (result.kind === 'apply') {
      expect(result.fieldPath).toBe('hero.primaryCta');
      expect(result.value).toBe('Contact Us');
    }
  });
});
