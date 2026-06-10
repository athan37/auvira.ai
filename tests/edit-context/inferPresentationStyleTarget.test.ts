import { describe, expect, it } from 'vitest';
import { inferPresentationStyleTarget } from '@/lib/project-workspace/edit-context/inferPresentationStyleTarget';

describe('inferPresentationStyleTarget', () => {
  it('routes contact information background to cardClass', () => {
    const result = inferPresentationStyleTarget(
      'edit the contact information background to green to red gradient',
      undefined,
      'hi, this hema'
    );
    expect(result.presentationField).toBe('cardClass');
    expect(result.confidence).toBe('high');
  });

  it('routes service cards phrasing to cardClass', () => {
    const result = inferPresentationStyleTarget(
      'change the service cards background to blue',
      undefined,
      'Our Services'
    );
    expect(result.presentationField).toBe('cardClass');
  });

  it('routes testimonial cards to cardClass', () => {
    const result = inferPresentationStyleTarget(
      'make the testimonial cards purple',
      undefined,
      'What Clients Say'
    );
    expect(result.presentationField).toBe('cardClass');
  });

  it('routes FAQ card backgrounds to cardClass', () => {
    const result = inferPresentationStyleTarget(
      'update the FAQ card backgrounds to yellow',
      undefined,
      'Common Questions'
    );
    expect(result.presentationField).toBe('cardClass');
  });

  it('routes gallery photo frames to cardClass', () => {
    const result = inferPresentationStyleTarget(
      'change the gallery photo frames to a blue to yellow gradient',
      undefined,
      'Our Work'
    );
    expect(result.presentationField).toBe('cardClass');
  });

  it('routes feature card background to cardClass', () => {
    const result = inferPresentationStyleTarget(
      'change the feature card background to red',
      undefined,
      'Why Choose Us'
    );
    expect(result.presentationField).toBe('cardClass');
  });

  it('keeps whole section background on explicit section phrasing', () => {
    const result = inferPresentationStyleTarget(
      'change the whole section background to blue',
      undefined,
      'Contact Us'
    );
    expect(result.presentationField).toBe('backgroundClass');
  });

  it('defaults ambiguous background requests to section wrapper', () => {
    const result = inferPresentationStyleTarget('make it red', undefined, 'Contact Us');
    expect(result.presentationField).toBe('backgroundClass');
  });

  it('routes heading color requests to titleClass', () => {
    const result = inferPresentationStyleTarget(
      'change heading color to green',
      undefined,
      'Upcoming Events'
    );
    expect(result.presentationField).toBe('titleClass');
    expect(result.confidence).toBe('high');
  });

  it('routes body text color requests to bodyClass', () => {
    const result = inferPresentationStyleTarget(
      'change the body text color to blue',
      undefined,
      'About Us'
    );
    expect(result.presentationField).toBe('bodyClass');
  });

  it('routes pinned Contact Information heading to inner card cardClass', () => {
    const result = inferPresentationStyleTarget(
      'change this to my favourite color — color clarification: green',
      {
        target: {
          kind: 'section',
          sectionIndex: 4,
          sectionType: 'contact',
          sectionTitle: 'Contact Us',
          fieldPath: 'sections[4].subtitle',
          targetChain: [
            { role: 'section', label: 'Contact Us', kind: 'contact' },
            { role: 'container', label: 'Contact card', kind: 'inner_card' },
            {
              role: 'element',
              label: 'Contact Information',
              kind: 'heading',
              fieldPath: 'sections[4].subtitle',
            },
          ],
        },
        resolved: {
          kind: 'section',
          sectionIndex: 4,
          sectionType: 'contact',
          sectionTitle: 'Contact Us',
          confidence: 'high',
        },
        element: {
          fieldPath: 'sections[4].subtitle',
          label: 'Contact Information',
        },
        editableFields: [],
        sourceHints: { siteConfigPath: 'src/lib/siteConfig.ts' },
      },
      'Contact Us'
    );
    expect(result.presentationField).toBe('cardClass');
    expect(result.confidence).toBe('high');
  });

  it('routes pinned inner card container to cardClass without naming the card', () => {
    const result = inferPresentationStyleTarget(
      'change the background to a blue to green gradient',
      {
        target: {
          kind: 'section',
          sectionIndex: 4,
          sectionType: 'contact',
          sectionTitle: 'Get Started Today',
          targetChain: [
            { role: 'section', label: 'Get Started Today', kind: 'contact' },
            { role: 'container', label: 'Contact card', kind: 'inner_card' },
          ],
        },
        resolved: {
          kind: 'section',
          sectionIndex: 4,
          sectionType: 'contact',
          sectionTitle: 'Get Started Today',
          confidence: 'high',
        },
        editableFields: [],
        sourceHints: { siteConfigPath: 'src/lib/siteConfig.ts' },
      },
      'Get Started Today'
    );
    expect(result.presentationField).toBe('cardClass');
    expect(result.confidence).toBe('high');
  });

  it('honors explicit whole section phrasing even when inner card is pinned', () => {
    const result = inferPresentationStyleTarget(
      'change the whole section background to blue',
      {
        target: {
          kind: 'section',
          sectionIndex: 4,
          targetChain: [
            { role: 'section', label: 'Get Started Today', kind: 'contact' },
            { role: 'container', label: 'Contact card', kind: 'inner_card' },
          ],
        },
        resolved: {
          kind: 'section',
          sectionIndex: 4,
          confidence: 'high',
        },
        editableFields: [],
        sourceHints: { siteConfigPath: 'src/lib/siteConfig.ts' },
      }
    );
    expect(result.presentationField).toBe('backgroundClass');
  });
});
